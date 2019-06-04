'use strict';

const moment = require('moment');

const NEVER = new Date(0);

module.exports = class CacheService {
	constructor(db) {
		this.createPlacemarkTable = this.createPlacemarkTable.bind(this);
		this.getPlacemarks = this.getPlacemarks.bind(this);
		this.getLastDateFromRows = this.getLastDateFromRows.bind(this);
		this.upsertPlacemarks = this.upsertPlacemarks.bind(this);
		this.db = db;
	}

	/**
	 * Static const for checking results
	 *
	 * @returns {Date} The NEVER NoOp value.
	 */
	static get NEVER() {
		return NEVER;
	}

	createPlacemarkTable() {
		process.stdout.write('.');
		return this.db.none(
			'CREATE SEQUENCE IF NOT EXISTS placemark_id_seq;' +
			'CREATE TABLE IF NOT EXISTS placemark (' +
				'id bigint PRIMARY KEY DEFAULT nextval(\'placemark_id_seq\'),' +
				'visibility boolean DEFAULT \'false\',' +
				'imei bigint,' +
				'time_utc timestamp without time zone DEFAULT now(),' +
				'time timestamp with time zone DEFAULT now(),' +
				'latitude numeric(9,6),' +
				'longitude numeric(9,6),' +
				'elevation text,' +
				'velocity text,' +
				'course text,' +
				'valid_gps_fix boolean DEFAULT \'false\'' +
			')'
		);
	}

	/**
	 *
	 * @param {string} order by value.
	 * @returns {Promise<T | Array>} Get the Placemarks.
	 */
	getPlacemarks(order = null) {
		return this.db.any('SELECT * FROM placemark' + ((order === null) ? '' : ' ORDER BY ' + order))
			.catch(() => {
				return [];
			});
	}

	getLastDateFromRows(rows) {
		const lastDate = (!rows || rows.length <= 0) ? NEVER : new Date(rows.pop().time);
		// Debug helper - console.log('\t - last cache database time: ' + lastDate + ' - ' + lastDate.toISOString());
		process.stdout.write('.');
		return lastDate;
	}

	/**
	 * Batch upsert placemarks, requires Posgres 9.5 or greater
	 *
	 * @param {*} placemarks data to upsert
	 * @returns {Promise<any>} A Promise for the upsert.
	 */
	/* eslint-disable no-template-curly-in-string */
	upsertPlacemarks(placemarks) {
		// Debug helper - console.log('\t - updating cache database');
		process.stdout.write('.');
		return this.db.tx(t => t.batch(placemarks.map(placemark => {
			placemark.timeUTC = moment(placemark.timeUTC).format('YYYY-MM-DD HH:mm:ss');
			placemark.time = moment(placemark.time).format('YYYY-MM-DD HH:mm:ss');
			return t.none(
				'INSERT INTO placemark (id, visibility, imei, time_utc, time, latitude, longitude, elevation, velocity, course, valid_gps_fix)' +
				'VALUES (${id}, ${visibility}, ${imei}, ${timeUTC}, ${time}, ${latitude}, ${longitude}, ${elevation}, ${velocity}, ${course}, ${validGpsFix})' +
				'ON CONFLICT (id)' +
				'DO UPDATE SET (visibility, imei, time_utc, time, latitude, longitude, elevation, velocity, course, valid_gps_fix) = (${visibility}, ${imei}, ${timeUTC}, ${time}, ${latitude}, ${longitude}, ${elevation}, ${velocity}, ${course}, ${validGpsFix})' +
				'WHERE placemark.id = ${id};', placemark);
		})));
	}
	/* eslint-enable no-template-curly-in-string */
};
