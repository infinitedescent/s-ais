'use strict';

const rp = require('request-promise-native');
const cheerio = require('cheerio');

module.exports = class MarineTrafficService {

	scrapeLastMarineTrafficUpdate() {
		console.log('\t - loading Marine Traffic data');

		const url = 'http://www.marinetraffic.com/en/ais/details/ships/shipid:4056865/mmsi:367725690/imo:0/vessel:CATHULHU/_:7c676f7c8b3c1476f89fbb3c37005f40';
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

}
