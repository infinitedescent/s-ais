'use strict';

const pgp = require('pg-promise')();
const xml2js = require('xml2js');
const moment = require('moment');
const sendgrid = require('sendgrid')(
	process.env.SENDGRID_USERNAME,
	process.env.SENDGRID_PASSWORD
);

const CacheService = require('./db/cache-service');
const InReachService = require('./delorme/inreach-service');
const MarineTrafficService = require('./marinetraffic/marinetraffic-service');

/**
 * ServerAIS Class
 *
 * @type {module.ServerAIS}
 */
module.exports = class ServerAIS {
	constructor(db) {
		this.db = db;
	}

	async synchronize() {
		process.stdout.write('SYNC');
		const cacheService = new CacheService(this.db);
		const marinetraffic = new MarineTrafficService();

		try {
			const placemarkRows = await cacheService.getPlacemarks('time_utc ASC');
			process.stdout.write('¢');
			const lastDate = await cacheService.getLastDateFromRows(placemarkRows);
			process.stdout.write('»');
			const vesselKml = await this.getVesselKml(lastDate);
			process.stdout.write('k');
			const placemarks = await this.parseKmlToPlacemarks(vesselKml);
			process.stdout.write(placemarks.length.toString());

			if (placemarks.length > 0) {
				await cacheService.upsertPlacemarks(placemarks);
				process.stdout.write('w');
				const mmsi = this.getMMSI();
				const lastMTUpdate = await marinetraffic.getLatestPositionTime(mmsi);
				process.stdout.write('.');
				const lastPlacemark = placemarks[placemarks.length - 1];
				const lastPlacemarkDate = new Date(lastPlacemark.timeUTC);

				if (this.shouldSelfReport(lastPlacemarkDate, lastMTUpdate)) {
					await this.sendSelfReport(lastPlacemark);
				}
			} else {
				process.stdout.write('×');
			}

			this.disconnectDb();
			process.stdout.write('\n');
		} catch (error) {
			this.disconnectDb();
			console.error(`[Error] ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get vessel route information since the last known entry as kml.
	 *
	 * @param {Date} lastEntry data after the date.
	 * @returns {*} The Vessel Kml data.
	 */
	async getVesselKml(lastEntry) {
		if (!process.env.MAPSHARE_ID) {
			throw new Error('MAPSHARE_ID environment variable is missing.');
		}

		return new InReachService()
			.getMapShareKML(process.env.MAPSHARE_ID, lastEntry);
	}

	/**
	 * Returns collection of placement objects from a KML.
	 *
	 * @param {*} kml data.
	 * @returns {Array} Array of Placemarks.
	 */
	async parseKmlToPlacemarks(kml) {
		/**
		 * Does placemark have ExtendedData data.
		 *
		 * @param {Placemark} placemark data.
		 * @returns {boolean} If placemark data is Non Extended.
		 */
		const nonExtendedData = placemark => {
			return (placemark.extendeddata);
		};

		/**
		 * Converts a placemark xml blob to a value object.
		 *
		 * @param {Placemark} placemark data.
		 * @returns {{id, visibility: string, imei, timeUTC: string, time: string, latitude, longitude, elevation, velocity, course, validGpsFix: string}} The Value Object (VO) for the target placemark.
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

		const blob = await new Promise((resolve, reject) => {
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
		});

		return (blob && blob.document && blob.document.folder && blob.document.folder.placemark) ? blob.document.folder.placemark
			.filter(nonExtendedData)
			.map(placemarkXmlToVo) : [];
	}

	shouldSelfReport(lastDBUpdate, lastMTUpdate) {
		const minToMSec = minutes => {
			return minutes * 60000;
		};

		const gracePeriod = 10;

		if (lastDBUpdate - lastMTUpdate >= minToMSec(gracePeriod)) {
			/**
			 * Marine Traffic is behind Delorme and over the 10 minute grace period.
			 */
			process.stdout.write('>');
			return true;
		}

		/**
		 * Delorme is behind Marine Traffic, either Marine Traffic is updating every minute
		 * which is normal near Receiving stations, or the Marine Traffic is behind, but
		 * under the 10 minute grace period, or the Delorme is off, or not tracking.
		 */
		if (lastDBUpdate - lastMTUpdate > 0) {
			process.stdout.write('Δ');
		} else {
			process.stdout.write('=');
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

		process.stdout.write('>');
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
		const email = {
			to: 'report@marinetraffic.com',
			from: process.env.REPORT_SENDER,
			subject: 'sAIS self-report',
			text: body
		};

		return new Promise(resolve => {
			sendgrid.send(email, (error, json) => {
				if (error) {
					console.error(error);
					throw error;
				}

				process.stdout.write('Λ');
				resolve(json);
			});
		});
	}

	disconnectDb() {
		pgp.end();
	}

	getMMSI() {
		if (!process.env.REPORT_MMSI) {
			throw new Error('REPORT_MMSI environment variable is missing.');
		}

		return process.env.REPORT_MMSI;
	}
};
