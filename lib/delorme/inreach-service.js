'use strict';

const rp = require('request-promise-native');

module.exports = class InReachService {
	/**
	 * Spec: https://files.delorme.com/support/inreachwebdocs/KML%20Feeds.pdf
	 *
	 * @param {string} mapShareId value.
	 * @param {string} startTime (optional)
	 * @param {string} endTime (optional)
	 * @param {string} imei (optional)
	 * @returns {{method: string, hostname: string, path: string, headers: {cache-control: string}}} The MapShare KML data.
	 */
	async getMapShareKML(mapShareId, startTime, endTime, imei) {
		const options = {
			uri: 'https://share.garmin.com/feed/Share/' + mapShareId,
			headers: {
				'cache-control': 'no-cache'
			}
		};

		if (startTime !== undefined || endTime !== undefined || imei !== undefined) {
			const qs = {};

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

		try {
			const result = await rp.get(options);
			if (!result.trim()
				.startsWith('<?xml')) {
				throw new Error('No KML was returned for MapShare: ' + mapShareId);
			}

			return result;
		} catch (error) {
			throw error;
		}
	}
};
