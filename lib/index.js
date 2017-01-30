'use strict';

const DeLormeMarineTrafficSynchronizer = require('./delorme-marinetraffic-synchronizer');

module.exports = (input, opts) => {
	if (typeof input !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof input}`);
	}

	opts = opts || {};
	// console.log(opts);

	// return input + ' & ' + (opts.postfix || 'rainbows');

	/**
	 * Starting from here...
	 */
	return new DeLormeMarineTrafficSynchronizer()
		.synchronize();
};
