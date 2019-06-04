'use strict';

const rp = require('request-promise-native');
const cheerio = require('cheerio');

module.exports = class MarineTrafficService {
	async getLatestPositionTime(mmsi) {
		const url = 'http://www.marinetraffic.com/en/ais/details/ships/mmsi:' + mmsi + '/';
		// Debug helper - console.log('\t - loading Marine Traffic data');
		try {
			const html = await rp(url);
			// Utilize the cheerio library on the returned html which will essentially give us jQuery functionality
			const $ = cheerio.load(html);
			const timeUTC = $('time').eq(1).attr('datetime');
			// Debug helper - console.log('\t - url loaded. time: ' + timeUTC);
			process.stdout.write('V');
			return new Date(timeUTC);
		} catch (error) {
			console.error('Error loading to Marine Traffic url:', error);
			throw error;
		}
	}
};
