'use strict';

const puppeteer = require('puppeteer');

module.exports = class MarineTrafficService {
	async getLatestPositionTime(mmsi) {
		const url = `http://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}/`;

		try {
			const browser = await puppeteer.launch();
			const page = await browser.newPage();
			await page.setViewport({width: 1920, height: 1080});
			await page.setCacheEnabled(false);
			await page.goto(url);
			// Wait for AJAX request which return last update time
			const response = await page.waitForResponse(response =>
				response.url().includes('/vesselDetails/latestPosition')
			);
			const data = await response.json();
			if (!data.lastPos) {
				throw new Error(
					'Last reported time not found in MarineTraffic request.'
				);
			}

			return new Date(data.lastPos * 1000);
		} catch (error) {
			console.error('Error loading to Marine Traffic url:', error);
			throw error;
		}
	}
};
