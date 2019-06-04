'use strict';

/**
 *
 * @returns {{host: string, port: number, database: string}} The data cache config object.
 */
module.exports = function () {
	process.stdout.write(((process.env.NODE_ENV || 'dev') === 'dev') ? 'LOCAL_DB:' : 'PROD_DB:');

	const local = {
		host: 'localhost',
		port: 5432,
		database: 'test_development'
	};
	const prod = process.env.DATABASE_URL;

	return ((process.env.NODE_ENV || 'dev') === 'dev') ? local : prod;
};
