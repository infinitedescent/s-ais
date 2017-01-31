'use strict';

/**
 *
 * @returns {{host: string, port: number, database: string}}
 */
module.exports = function() {
	console.log((process.env.NODE_ENV || 'dev') ? '\t - DB in dev mode' : '\t - DB in prod mode' );

	const local = {
		host: 'localhost',
		port: 5432,
		database: 'test_development'
	};
	const prod = process.env.DATABASE_URL;

	return ((process.env.NODE_ENV || 'dev') === 'dev') ? local : prod;
};
