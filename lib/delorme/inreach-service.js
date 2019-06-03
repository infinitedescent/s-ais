'use strict';

const rp = require('request-promise-native');

module.exports = class InReachService {

	/**
	 * spec: https://files.delorme.com/support/inreachwebdocs/KML%20Feeds.pdf
	 *
	 * @param mapShareId
	 * @param startTime (optional)
	 * @param endTime (optional)
	 * @param imei (optional)
	 * @returns {{method: string, hostname: string, path: string, headers: {cache-control: string}}}
	 */
	getMapShareKML(mapShareId, startTime, endTime, imei) {
		let options = {
			uri: 'https://share.garmin.com/feed/Share/' + mapShareId,
			headers: {
				'cache-control': 'no-cache'
			}
		};

		if (startTime !== undefined || endTime !== undefined || imei !== undefined) {
			let qs = {};
			if (startTime !== undefined) {
				qs.d1 = startTime.toISOString();
			}
			if (endTime !== undefined) {
				qs.d2 = endTime.toISOString();
			}
			if (imei !== undefined) {
				qs.imei = imei.join(',');
			}
			options.qs = qs;
		}

		return rp.get(options)
			.then(result => {
				// DeLorme does not return 400 or other errors if vessel name
				// is incorrect, or if other data is incorrect.
				if (!result.trim()
						.startsWith('<?xml')) {
					throw new Error('No KML was returned for MapShare: ' + mapShareId);
				}
				return result;
			});
	}
};
