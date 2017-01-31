'use strict';

const pgp = require('pg-promise')();
const xml2js = require('xml2js');
const moment = require('moment');
const sendgrid = require('sendgrid')(
	process.env.SENDGRID_USERNAME,
	process.env.SENDGRID_PASSWORD
);

const dbConfig = require('./db/cache-config');
const CacheService = require('./db/cache-service');
const DelormeService = require('./delorme/explore-service');
const MarineTrafficService = require('./marinetraffic/marinetraffic-service');

module.exports = class ServerAIS {

	/**
	 *
	 */
	synchronize() {
		console.log('Synchronize');
		const db = pgp(dbConfig());
		const service = new CacheService(db);
		const marinetraffic = new MarineTrafficService();
		let lastPlacemark = null;

		service.getPlacemarks('time_utc ASC')
			.then(service.getLastDateFromRows)
			.then(this.getVesselKml)
			.then(this.parseKmlToPlacemarks)
			.then(placemarks => {
				lastPlacemark = placemarks[placemarks.length - 1];
				return placemarks;
			})
			.then(service.upsertPlacemarks)
			.then(this.getMMSI)
			.then(marinetraffic.getLatestPositionTime)
			.then(lastMTUpdate => {
				console.log('\t - last MarineTraffic time: ' + lastMTUpdate);
				const lastPlacemarkDate = new Date(lastPlacemark.timeUTC);
				if (this.shouldSelfReport(lastPlacemarkDate, lastMTUpdate)) {
					return this.sendSelfReport(lastPlacemark);
				}
			})
			.then(this.disconnectDb)
			.then(() => {
				console.log('\t - complete');
			})
			.catch(err => {
				this.disconnectDb();

				console.error('Synchronize failed!');
				throw err;
			});

		return '';
	}

	/**
	 * Get vessel route information since the last known entry as kml.
	 *
	 * @param lastEntry {Date}
	 * @returns {*}
	 */
	getVesselKml(lastEntry) {
		if (!process.env.MAPSHARE_ID) {
			throw new Error('MAPSHARE_ID environment variable is missing.');
		}
		if (!process.env.DEVICE_IMEI) {
			throw new Error('DEVICE_IMEI environment variable is missing.');
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
	parseKmlToPlacemarks(kml) {
		console.log('\t - parsing KML for placemarks');

		/**
		 * Does placemark have ExtendedData data.
		 *
		 * @param placemark
		 * @returns {boolean}
		 */
		const nonExtendedData = placemark => {
			return (placemark.extendeddata);
		};

		/**
		 * Converts a placemark xml blob to a value object.
		 *
		 * @param placemark
		 * @returns {{id, visibility: string, imei, timeUTC: string, time: string, latitude, longitude, elevation, velocity, course, validGpsFix: string}}
		 */
		const placemarkXmlToVo = placemark => {
			const getProperty = (placemark, name) => {
				const data = placemark.extendeddata.data
					.filter(obj => {
						return (obj.name === name);
					})
					.pop();
				if (!data || !data.value) {
					throw new Error('Placemark does not have property: ' + name);
				}
				return data.value;
			};

			return {
				id: getProperty(placemark, 'Id'),
				imei: getProperty(placemark, 'IMEI'),
				timeUTC: new Date(getProperty(placemark, 'Time UTC')),
				time: new Date(getProperty(placemark, 'Time')),
				latitude: getProperty(placemark, 'Latitude'),
				longitude: getProperty(placemark, 'Longitude'),
				elevation: getProperty(placemark, 'Elevation'),
				velocity: getProperty(placemark, 'Velocity'),
				course: getProperty(placemark, 'Course'),
				validGpsFix: getProperty(placemark, 'Valid GPS Fix').toLowerCase(),
				visibility: placemark.visibility.toLowerCase()
			};
		};

		return new Promise((resolve, reject) => {
			new xml2js.Parser({
				mergeAttrs: true,
				explicitRoot: false,
				explicitArray: false,
				normalizeTags: true,
				preserveChildrenOrder: true
			}).parseString(kml, (err, data) => {
				if (err) {
					reject(err);
				}
				resolve(data);
			});
		}).then(blob => {
			return blob.document.folder.placemark
				.filter(nonExtendedData)
				.map(placemarkXmlToVo);
		});
	}

	shouldSelfReport(lastDBUpdate, lastMTUpdate) {
		const minToMSec = minutes => {
			return minutes * 60000;
		};

		const msecToMin = msec => {
			return Math.floor(msec / 60000);
		};

		const gracePeriod = 10;
		if (lastDBUpdate - lastMTUpdate >= minToMSec(gracePeriod)) {
			// Marine Traffic is behind Delorme and over the 10 minute grace period.
			console.log('\t - MarineTraffic is ' + msecToMin(lastDBUpdate - lastMTUpdate) + ' minutes behind Delorme, ' + (msecToMin(lastDBUpdate - lastMTUpdate) - gracePeriod) + ' minutes over the grace period');
			return true;
		}
			// Delorme is behind Marine Traffic, either Marine Traffic is updating every minute
			// which is normal near Receiving stations, or the Marine Traffic is behind, but
			// under the 10 minute grace period, or the Delorme is off, or not tracking.
		if (lastDBUpdate - lastMTUpdate > 0) {
			console.log('\t - MarineTraffic is ' + msecToMin(lastDBUpdate - lastMTUpdate) + ' minutes behind Delorme, but ' + (gracePeriod - msecToMin(lastDBUpdate - lastMTUpdate)) + ' minutes remains in grace period');
		} else {
			console.log('\t - MarineTraffic is up-to-date');
		}
		return false;
	}

	sendSelfReport(data) {
		if (!process.env.REPORT_SENDER) {
			throw new Error('REPORT_SENDER environment variable is missing.');
		}

		if (!process.env.REPORT_MMSI) {
			throw new Error('REPORT_MMSI environment variable is missing.');
		}

		const kmPerHrToKnots = kmPerHr => {
			return kmPerHr * 0.539957;
		};

		const pad = (n, width, z) => {
			z = z || '0';
			n = String(n);
			return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
		};

		console.log('\t - Sending update to Marine Traffic.');
		const knots = kmPerHrToKnots(data.velocity.split(' ')[0]);
		const course = pad(data.course.split('.')[0], 3);
		const timestamp = moment(data.timeUTC).format('YYYY-MM-DD HH:mm:ss');
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
			from: process.env.REPORT_SENDER,
			subject: 'sAIS self-report',
			text: body
		};

		return new Promise(resolve => {
			sendgrid.send(email, (err, json) => {
				if (err) {
					console.error(err);
					throw err;
				}

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
		if (!process.env.REPORT_MMSI) {
			throw new Error('REPORT_MMSI environment variable is missing.');
		}
		return process.env.REPORT_MMSI;
	}
};
