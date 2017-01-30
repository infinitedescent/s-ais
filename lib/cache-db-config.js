'use strict';

/**
 *
 * @returns {pg-promise config}
 */
module.exports = function() {
	const local = {
		host: 'localhost',
		port: 5432,
		database: 'test_development'
	};
	const prod = process.env.DATABASE_URL;

	return ((process.env.NODE_ENV || 'dev') === 'dev') ? local : prod;
};
