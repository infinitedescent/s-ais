'use strict';

const rp = require('request-promise-native');

module.exports = class DelormeService {

	/**
	 * spec: https://files.delorme.com/support/inreachwebdocs/KML%20Feeds.pdf
	 *
	 * @param mapShareId
	 * @param imei
	 * @param startTime
	 * @param endTime
	 * @returns {{method: string, hostname: string, path: string, headers: {cache-control: string}}}
	 */
	getMapShareKML(mapShareId, imei, startTime, endTime = new Date()) {
		const options = {
			uri: 'https://share.delorme.com/feed/Share/' + mapShareId,
			qs: {
				imei: imei,
				d1: startTime.toISOString(),
				d2: endTime.toISOString()
			},
			headers: {
				'cache-control': 'no-cache'
			}
		};

		return rp.get(options)
			.then(result => {
				// DeLorme does not return 400 or other errors if vessel name
				// is incorrect, or if other data is incorrect.
				if (!result.trim()
						.startsWith('<?xml')) {
					throw new Error('No KML was returned for MapShare: ' + mapShareId + ' and device: ' + imei);
				}
				return result;
			});
	}

};
