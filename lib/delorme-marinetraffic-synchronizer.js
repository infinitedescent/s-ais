'use strict';

const pgp = require('pg-promise')();
const _ = require('lodash');
const libxmljs = require('libxmljs');
const moment = require('moment');
const sendgrid  = require('sendgrid')(
	process.env.SENDGRID_USERNAME,
	process.env.SENDGRID_PASSWORD
);

const dbConfig = require('./cache-db-config');
const CacheService = require('./cache-service');
const DelormeService = require('./delorme/delorme-service');
const MarineTrafficService = require('./marinetraffic/marinetraffic-service');

module.exports = class DelormeRequestOptionFactory {

	/**
	 *
	 */
	synchronize() {

		const db = pgp(dbConfig());
		const service = new CacheService(db);
		const marinetraffic = new MarineTrafficService();
		let lastPlacemark = null;

		service.getPlacemarks('time_utc ASC')
			.then(service.getLastDateFromRows)
			.then(this.getVesselKml)
			.then(this.placemarksFromKml)
			.then(placemarks => {
				lastPlacemark = placemarks[placemarks.length - 1];
				return placemarks;
			})
			.then(service.upsertPlacemarks)
			.then(this.getMMSI)
			.then(marinetraffic.scrapeLastMarineTrafficUpdate)
			.then(lastMTUpdate => {
				console.log('\t - last MarineTraffic time: ' + lastMTUpdate);
				const lastPlacemarkDate = new Date(lastPlacemark.timeUTC);

				if(this.updateMarineTraffic(lastPlacemarkDate, lastMTUpdate)) {
					return this.sendMarineTrafficUpdate(lastPlacemark);
				}
			})
			.then(this.disconnectDb)
			.then(result => {
				console.log('\t - complete');
			})
			.catch(error => {
				this.disconnectDb();

				console.error('Synchronize failed!');
				throw error;
			});

		return 'Synchronize:';
	}

	/**
	 * Get vessel route information since the last known entry as kml.
	 *
	 * @param lastEntry {Date}
	 * @returns {*}
	 */
	getVesselKml(lastEntry) {
		if(!process.env.MAPSHARE_ID) {
			throw Error('MAPSHARE_ID environment variable is missing.');
		}
		if(!process.env.DEVICE_IMEI) {
			throw Error('DEVICE_IMEI environment variable is missing.');
		}

		return new DelormeService()
			.getMapShareKML(process.env.MAPSHARE_ID, process.env.DEVICE_IMEI, lastEntry);
	}

	/**
	 * Returns collection of placement objects from a KML.
	 *
	 * @param kml
	 * @returns {Array}
	 */
	placemarksFromKml(kml) {
		console.log('\t - parsing KML for placemarks');

		/**
		 * Does placemark have ExtendedData data.
		 *
		 * @param placemark
		 * @returns {boolean}
		 */
		const nonExtendedData = placemark => {
			return (placemark.find('ExtendedData').length > 0);
		};

		/**
		 * Converts a placemark xml blob to a value object.
		 *
		 * @param placemark
		 * @returns {{id, visibility: string, imei, timeUTC: string, time: string, latitude, longitude, elevation, velocity, course, validGpsFix: string}}
		 */
		const placemarkXmlToVo = placemark => {
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
		};

		const xml = libxmljs.parseXmlString(kml);
		return libxmljs
			.parseXmlString(xml.child(1).toString())
			.find('//Placemark')
			.filter(nonExtendedData)
			.map(placemarkXmlToVo);
	}

	updateMarineTraffic(lastDBUpdate, lastMTUpdate) {
		const minToMSec = minutes => {
			return minutes * 60000;
		}

		const msecToMin = msec => {
			return Math.floor(msec / 60000);
		}

		const gracePeriod = 10;
		if(lastDBUpdate - lastMTUpdate >= minToMSec(gracePeriod)) {
			// Marine Traffic is behind Delorme and over the 10 minute grace period.
			console.log('\t - MarineTraffic is ' + msecToMin(lastDBUpdate - lastMTUpdate) + ' minutes behind Delorme, ' + (msecToMin(lastDBUpdate - lastMTUpdate) - gracePeriod) + ' minutes over the grace period');
			return true;
		} else {
			// Delorme is behind Marine Traffic, either Marine Traffic is updating every minute
			// which is normal near Receiving stations, or the Marine Traffic is behind, but
			// under the 10 minute grace period, or the Delorme is off, or not tracking.
			if(lastDBUpdate - lastMTUpdate > 0) {
				console.log('\t - MarineTraffic is ' + msecToMin(lastDBUpdate - lastMTUpdate) + ' minutes behind Delorme, but ' + (gracePeriod - msecToMin(lastDBUpdate - lastMTUpdate)) + ' minutes remains in grace period');
			} else {
				console.log('\t - MarineTraffic is up-to-date');
			}
			return false;
		}
	}

	sendMarineTrafficUpdate(data) {
		if(!process.env.EMAIL_FROM) {
			throw Error('EMAIL_FROM environment variable is missing.');
		}

		const kmPerHrToKnots = kmPerHr => {
			return kmPerHr * 0.539957;
		};

		const pad = (n, width, z) => {
			z = z || '0';
			n = n + '';
			return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
		};

		console.log('\t - Sending update to Marine Traffic.');
		const knots = kmPerHrToKnots(data.velocity.split(' ')[0]);
		const course = pad(data.course.split('.')[0], 3);
		const timestamp = moment(data.timeUTC).format("YYYY-MM-DD HH:mm:ss");
		const body = '________________\n' +
			'MMSI=' + process.env.REPORT_MMSI + '\n' +
			'LAT=' + data.latitude + '\n' +
			'LON=' + data.longitude + '\n' +
			'SPEED=' + knots + '\n' +
			'COURSE=' + course + '\n' +
			'TIMESTAMP=' + timestamp + '\n' +
			'________________';
		console.log(body);

		const email = {
			to: 'report@marinetraffic.com',
			from: process.env.REPORT_FROM,
			subject: process.env.REPORT_TITLE,
			text: body
		};

		return new Promise(resolve => {
			sendgrid.send( email, (err, json) => {
				if (err) {
					console.error(err);
					throw err;
				};

				console.log('\t - e-mail sent successfully.');
				resolve(json);
			});
		});
	}

	disconnectDb() {
		console.log('\t - disconnect from database');
		pgp.end();
	}

	getMMSI() {
		if(!process.env.REPORT_MMSI) {
			throw Error('REPORT_MMSI environment variable is missing.');
		}
		return process.env.REPORT_MMSI;
	}
};
