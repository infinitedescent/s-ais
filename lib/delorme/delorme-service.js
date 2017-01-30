'use strict';

const rp = require('request-promise-native');

module.exports = class DelormeService {

	/**
	 * The url we want is: 'https://share.delorme.com/feed/Share/cathulhu?d1=2016-05-16T06:19Z&d2=2012-10-16T06:19Z'
	 * d1 is start time
	 * d2 is end time
	 * returns KML file
	 *
	 * spec: https://files.delorme.com/support/inreachwebdocs/KML%20Feeds.pdf
	 *
	 * @param name
	 * @param startTime
	 * @param endTime
	 * @returns {{method: string, hostname: string, path: string, headers: {cache-control: string}}}
	 */
	getShareKML(name, startTime, endTime = new Date()) {
		const options = {
			uri: 'https://share.delorme.com/feed/Share/' + name,
			qs: {
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
				if(!result.trim()
						.startsWith('<?xml')) {
					throw Error('No kml was returned, check the VESSEL_ID.');
				}
				return result;
			});
	}

};
