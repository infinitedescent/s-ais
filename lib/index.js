'use strict';

const ServerAIS = require('./s-ais');

module.exports = (input, opts) => {
	if (typeof input !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof input}`);
	}

	opts = opts || {};

	/**
	 * force synchronize for now
	 */
	return new ServerAIS(opts)
		.synchronize();
};
