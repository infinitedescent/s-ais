#!/usr/bin/env node

/**
 * The original application was thrown together in a few evening before
 * a trip to Alaska.  In many respects, this is horrible code that does
 * not follow any best-practices. This code is included for both
 * historical reasons and a level of transparency.
 */

var libxmljs = require("libxmljs");
var moment = require("moment");
var http = require("https");
var pg = require('pg');
var sendgrid  = require('sendgrid')(
	process.env.SENDGRID_USERNAME,
	process.env.SENDGRID_PASSWORD
);
var request = require('request');
var cheerio = require('cheerio');
var config = require('../config.json');

function connectToPlacemarkDb(dbUrl, callback) {
	pg.connect(dbUrl, function(err, client, done) {
		if (err) {
			console.error('Error connecting to Postgres: ', err);
			return callback(err);
		}
		callback(null, client, done);
	});
}

function handleError(err, client, done) {
	if(!err) {
		return false;
	}

	done(client);
	next(err);
	return true;
}

function requestDelormeKML(name, startTime, endTime, callback) {
	// The url we want is: 'https://share.delorme.com/feed/Share/SHARE_ID?d1=2016-05-16T06:19Z&d2=2012-10-16T06:19Z'
	// d1 is start time
	// d2 is end time
	// returns KML file
	// spec: https://files.delorme.com/support/inreachwebdocs/KML%20Feeds.pdf
	function createDelormeRequestOptions(name, startTime, endTime) {
		return  {
			"method": "GET",
			"hostname": "share.delorme.com",
			"path": '/feed/Share/' + name + '?d1=' + startTime + '&d2=' + endTime,
			"headers": {
				"cache-control": "no-cache"
			}
		};
	}

	function parsePlacemarkToVo(placemark) {
		return {
			id: placemark.get('ExtendedData/Data[@name="Id"]/value').text(),
			visibility: placemark.get('visibility').text().toLowerCase(),
			imei: placemark.get('ExtendedData/Data[@name="IMEI"]/value').text(),
			timeUTC: new Date(placemark.get('ExtendedData/Data[@name="Time UTC"]/value').text()),
			time: new Date(placemark.get('ExtendedData/Data[@name="Time"]/value').text()),
			latitude: placemark.get('ExtendedData/Data[@name="Latitude"]/value').text(),
			longitude: placemark.get('ExtendedData/Data[@name="Longitude"]/value').text(),
			elevation: placemark.get('ExtendedData/Data[@name="Elevation"]/value').text(),
			velocity: placemark.get('ExtendedData/Data[@name="Velocity"]/value').text(),
			course: placemark.get('ExtendedData/Data[@name="Course"]/value').text(),
			validGpsFix: placemark.get('ExtendedData/Data[@name="Valid GPS Fix"]/value').text().toLowerCase()
		};
	}

	var options = createDelormeRequestOptions(name, startTime, endTime);
	console.log('\t - request delorme data - https://' + options.hostname + options.path);

	var req = http.request(options, function (res) {
		var chunks = [];

		res.on("data", function (chunk) {
			chunks.push(chunk);
		});

		res.on("end", function () {
			var body = Buffer.concat(chunks);
			var xml = body.toString();

			var rootXml = libxmljs.parseXmlString(xml);
			// to get around the Namespace, create a new XML
			var documentXml = libxmljs.parseXmlString(rootXml.child(1).toString());
			var placemarks = documentXml.find('//Placemark');

			var data = [];
			for(var i=0; i < placemarks.length; i++) {
				if(placemarks[i].find('ExtendedData').length <= 0) {
					continue;
				}

				var placemarkVO = parsePlacemarkToVo(placemarks[i]);
				data.push(placemarkVO);
			}

			callback(null, data);
		});
	});

	req.end();
}

function scrapeLastMarineTrafficUpdate(callback) {
	var url = 'http://www.marinetraffic.com/en/ais/details/ships/shipid:{SHIP_ID}/mmsi:{MMSI}/imo:0/vessel:{VESSEL}/';
	console.log('\t - loading Marine Traffic data');

	// The structure of our request call
	// The first parameter is our URL
	// The callback function takes 3 parameters, an error, response status code and the html
	request(url, function(err, response, html) {
		// First we'll check to make sure no errors occurred when making the request
		if (err) {
			console.error('Error loading to Marine Traffic url: ', err);
			return callback(err);
		}

		// utilize the cheerio library on the returned html which will essentially give us jQuery functionality
		var $ = cheerio.load(html);
		$('body > div.container-fluid.has-ad-space.detail-page > div.row.gutter-10 > div.col-md-6.col-lg-5 > div:nth-child(3) > div.panel-body.text-left.short-line > div.table-cell.cell-full.collapse-768').filter(function () {
			var timeUTC = $(this).find($('time')).first().attr('datetime');
			if(!timeUTC) {
				console.error('Error scraping for "datetime" on Marine Traffic.', err);
				return callback(err);
			}
			callback(null, new Date(timeUTC));
		});
	});
}

function updateMarineTraffic(lastDBUpdate, lastMTUpdate) {
	function minToMSec(minutes) {
		return minutes * 60000;
	}

	function msecToMin(msec) {
		return Math.floor(msec / 60000);
	}

	var gracePeriod = 10;
	if(lastDBUpdate - lastMTUpdate >= minToMSec(gracePeriod)) {
		// Marine Traffic is behind Delorme and over the 10 minute grace period.
		console.log('\t - Marine Traffic is ' + msecToMin(lastDBUpdate - lastMTUpdate) + ' minutes behind Delorme, ' + (msecToMin(lastDBUpdate - lastMTUpdate) - gracePeriod) + ' minutes over the grace period.');
		return true;
	} else {
		// Delorme is behind Marine Traffic, either Marine Traffic is updating every minute
		// which is normal near Receiving stations, or the Marine Traffic is behind, but
		// under the 10 minute grace period, or the Delorme is off, or not tracking.
		if(lastDBUpdate - lastMTUpdate > 0) {
			console.log('\t - Marine Traffic is ' + msecToMin(lastDBUpdate - lastMTUpdate) + ' minutes behind Delorme, but ' + (gracePeriod - msecToMin(lastDBUpdate - lastMTUpdate)) + ' minutes remains in grace period.');
		} else {
			console.log('\t - Marine Traffic is up today.');
		}
		return false;
	}
}

function kmPerHrToKnots(kmPerHr) {
	return kmPerHr * 0.539957;
}

function sendMarineTrafficUpdate(data) {
	console.log('\t - Sending update to Marine Traffic.');
	var knots = kmPerHrToKnots(data.velocity.split(' ')[0]);
	var course = pad(data.course.split('.')[0], 3);
	var body = createMessage(config.mmsi, data.latitude, data.longitude, knots, course, moment(data.timeUTC).format("YYYY-MM-DD HH:mm:ss"));

	console.log(body);
	sendgrid.send({
		to: 'report@marinetraffic.com',
		from: '{EMAIL_FROM}',
		subject: 'Delorme > Marine Traffic Sync',
		text: body
	}, function(err, json) {
		if(err) {
			console.error(err);
			return;
		}
		console.log('\t - e-mail sent successfully.');
		end();
	});
}

function pad(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

/**
 * @param mmsi 0123456789
 * @param lat 48.4929646
 * @param lon -122.6803961;
 * @param speed 0
 * @param course 005
 * @param timestamp "2016-05-02 22:00"
 */
function createMessage(mmsi, lat, lon, speed, course, timestamp) {
	var body = '________________\n' +
		'MMSI=' + mmsi + '\n' +
		'LAT=' + lat + '\n' +
		'LON=' + lon + '\n' +
		'SPEED=' + speed + '\n' +
		'COURSE=' + course + '\n' +
		'TIMESTAMP=' + timestamp + '\n' +
		'________________';
	return body;
}

// fin
function end() {
	process.exit(0);
}

// bootstrap
connectToPlacemarkDb(process.env.DATABASE_URL, function(err, client, done) {
	if(err) {
		return console.error('Error connecting to Postgres: ', err);
	}

	console.log('Connected to placemark Postgres DB.');
	queryLastRecordedTime(client, onQueryLastRecordedTime);

	function queryLastRecordedTime(client, callback) {
		// get list of all data points in order
		client.query('SELECT * FROM placemark ORDER BY time_utc ASC', function(err, data) {
			if(err) {
				callback(err);
				return;
			}

			var lastTime = data.rows.pop();
			callback(null, lastTime);
		});
	}

	function onQueryLastRecordedTime(err, data) {
		if(handleError(err, client, done)) {
			console.log('postgres error! ' + err.toString());
			return;
		}

		console.log('\t - last DB time: ' + data.time + ' - ' + data.time.toISOString());
		// console.log(JSON.stringify(data));

		var lastRecord = data.time;
		var now = new Date();
		requestDelormeKML(config.vesselName, lastRecord.toISOString(), now.toISOString(), onRequestDelormeKML);
	}

	function onRequestDelormeKML(err, data) {
		if(err) {
			return console.error('requestDelormeKML Error: ', err);
		}

		upsertPlacemarks(client, data);
		done(); // end the db connection.
		console.log('Disconnected from postgres!');

		scrapeLastMarineTrafficUpdate(function(err, lastMTUpdate) {
			if(err) {
				return console.error('scrapeLastMarineTrafficUpdate Error: ', err);
			}

			console.log('\t - last Marine Traffic time: ' + lastMTUpdate);
			var lastDBUpdateData = data.pop();
			var lastDBUpdate = new Date(lastDBUpdateData.timeUTC);
			if(updateMarineTraffic(lastDBUpdate, lastMTUpdate)) {
				sendMarineTrafficUpdate(lastDBUpdateData);
			} else {
				end();
			}
		});
	}

	// update placemarks in the db, safe because each placemark has an UID
	function upsertPlacemarks(client, placemarks) {
		for(var i=0; i < placemarks.length; i++) {
			var placemark = placemarks[i];
			upsertPlacemark(client, placemark);
		}
	}

	function upsertPlacemark(client, placemark) {
		// console.log(moment(placemark.timeUTC).format("YYYY-MM-DD HH:mm:ss"));
		// console.log(JSON.stringify(placemark));

		client.query("UPDATE placemark SET visibility=($1), imei=($2), time_utc=($3), time=($4), latitude=($5), longitude=($6), elevation=($7), velocity=($8), course=($9), valid_gps_fix=($10) WHERE id=($11)", [
			placemark.visibility,
			placemark.imei,
			moment(placemark.timeUTC).format("YYYY-MM-DD HH:mm:ss"),
			moment(placemark.time).format("YYYY-MM-DD HH:mm:ss"),
			placemark.latitude,
			placemark.longitude,
			placemark.elevation,
			placemark.velocity,
			placemark.course,
			placemark.validGpsFix,
			placemark.id
		]);

		client.query("INSERT INTO placemark (id, visibility, imei, time_utc, time, latitude, longitude, elevation, velocity, course, valid_gps_fix) " +
			"SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11 " +
			"WHERE NOT EXISTS (SELECT 1 FROM placemark WHERE id=$1);", [
			placemark.id,
			placemark.visibility,
			placemark.imei,
			moment(placemark.timeUTC).format("YYYY-MM-DD HH:mm:ss"),
			moment(placemark.time).format("YYYY-MM-DD HH:mm:ss"),
			placemark.latitude,
			placemark.longitude,
			placemark.elevation,
			placemark.velocity,
			placemark.course,
			placemark.validGpsFix
		]);
	}
});
