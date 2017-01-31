'use strict';

const rp = require('request-promise-native');
const cheerio = require('cheerio');

module.exports = class MarineTrafficService {

	getLatestPositionTime(mmsi) {
		console.log('\t - loading Marine Traffic data');

		const url = 'http://www.marinetraffic.com/en/ais/details/ships/mmsi:' + mmsi + '/';
		return rp(url)
			.then(html => {
				// utilize the cheerio library on the returned html which will essentially give us jQuery functionality
				const $ = cheerio.load(html);
				const timeUTC = $('time').eq(1).attr('datetime');
				// console.log('\t - url loaded. time: ' + timeUTC);
				return new Date(timeUTC);
			})
			.catch(err => {
				console.error('Error loading to Marine Traffic url: ', err);
				throw err;
			});
	}

};
