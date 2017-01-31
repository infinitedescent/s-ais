'use strict';

const DeLormeMarineTrafficSynchronizer = require('./delorme-marinetraffic-synchronizer');

module.exports = (input, opts) => {
	if (typeof input !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof input}`);
	}

	opts = opts || {};

	/**
	 * force synchronize for now
	 */
	return new DeLormeMarineTrafficSynchronizer(opts)
		.synchronize();
};
