'use strict';

const moment = require('moment');

const NEVER = new Date(0);

module.exports = class CacheService {

	constructor(db) {
		this.getPlacemarks = this.getPlacemarks.bind(this);
		this.getLastDateFromRows = this.getLastDateFromRows.bind(this);
		this.upsertPlacemarks = this.upsertPlacemarks.bind(this);

		this.db = db;
	}

	/**
	 * static const for checking results
	 *
	 * @returns {Date}
	 */
	static get NEVER() {
		return NEVER;
	}

	/**
	 *
	 * @returns {Promise}
	 */
	getPlacemarks(order = null) {
		return this.db.any('SELECT * FROM placemark' + (!order ? '' : ' ORDER BY ' + order));
	}

	getLastDateFromRows(rows) {
		const lastDate = (!rows || rows.length <= 0) ? NEVER : new Date(rows.pop().time);
		console.log('\t - last cache database time: ' + lastDate); // + ' - ' + lastDate.toISOString());
		return lastDate;
	}

	/**
	 * batch upsert placemarks, requires Posgres 9.5 or greater
	 *
	 * @param placemarks
	 */
	upsertPlacemarks(placemarks) {
		console.log('\t - updating cache database');
		return this.db.tx(t => t.batch(placemarks.map(placemark => {
			placemark.timeUTC = moment(placemark.timeUTC).format("YYYY-MM-DD HH:mm:ss");
			placemark.time = moment(placemark.time).format("YYYY-MM-DD HH:mm:ss");
			t.none(
				'INSERT INTO placemark (id, visibility, imei, time_utc, time, latitude, longitude, elevation, velocity, course, valid_gps_fix)' +
				'VALUES (${id}, ${visibility}, ${imei}, ${timeUTC}, ${time}, ${latitude}, ${longitude}, ${elevation}, ${velocity}, ${course}, ${validGpsFix})' +
				'ON CONFLICT (id)' +
				'DO UPDATE SET (visibility, imei, time_utc, time, latitude, longitude, elevation, velocity, course, valid_gps_fix) = (${visibility}, ${imei}, ${timeUTC}, ${time}, ${latitude}, ${longitude}, ${elevation}, ${velocity}, ${course}, ${validGpsFix})' +
				'WHERE placemark.id = ${id};', placemark)
		})));
	}
};
