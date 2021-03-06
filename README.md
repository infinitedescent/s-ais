sAIS
====
[![Build Status](https://travis-ci.org/infinitedescent/s-ais.svg)](https://travis-ci.org/infinitedescent/s-ais) [![Coverage Status](https://coveralls.io/repos/github/infinitedescent/s-ais/badge.svg)](https://coveralls.io/github/infinitedescent/s-ais) [![Known Vulnerabilities](https://snyk.io/test/github/infinitedescent/s-ais/badge.svg)](https://snyk.io/test/github/infinitedescent/s-ais) [![GitHub release](https://img.shields.io/github/release/infinitedescent/s-ais.svg)]()
[![Donate](https://img.shields.io/badge/Donate-PayPal-red.svg)](https://www.paypal.me/serverAIS)

<img align="left" style="margin-right: 10px;" src="https://user-images.githubusercontent.com/138324/27362054-5b760816-55e0-11e7-913c-49e4d8206e50.png"/>

sAIS is a web service for updating the AIS position of a vessel on [MarineTraffic.com](https://www.marinetraffic.com/) with the Satellite tracking data from a [Garmin/DeLorme inReach device](https://explore.garmin.com/en-US/inreach/) when out of range of terrestrial AIS receiving stations.  The service is configured to run every 10 minutes on a free [Heroku](https://www.heroku.com) (see note below) account. During that period, if no positional updates occurred from AIS receiving stations, the service will send a [self-report](https://www.marinetraffic.com/en/p/report-your-own-position), which gives ample time for the more frequent AIS receiving stations which typically report every minute.

 > :exclamation: Unfortunately, [Heroku](https://www.heroku.com/) now requires users enter a credit card to 'activate' their accounts for [Account Verfication](https://devcenter.heroku.com/articles/account-verification) purposes. While _sAIS_ is designed to run completely free on Heroku, there is NO guaranty.
 
This software is authored as an alternative for recreational mariners to promote cruising and share their adventure without having to invest in costly satellite tracking systems intended for commercial fleets, nor costly Satellite Internet connectivity.

 > Please consider a [donation](https://www.paypal.me/serverAIS) to help ensure the maintenance and future improvements of sAIS.

Install
-------
#### Requirements
- A Heroku account for hosting the sAIS service. [Sign up for FREE here.](https://signup.heroku.com/) (See note above about Heroku account verification.)
- the vessels **MMSI** (Maritime Mobile Service Identity) number.
- an inReach device, with _MapShare_ set to **On** in your inReach settings. You will need your **MapShare ID**
	- It's recommended to have a Garmin plan that includes _Unlimited tracking at 10 minute intervals_.
- An e-mail address which will be used as the FROM address or **SENDER** for each MarineTraffic self report.

#### Deploy sAIS
sAIS is designed to be incredibly easy to setup and run, just click on the *Deploy to Heroku* button to start the process. The link will navigate you to Heroku.com and starts the 'Create a New App' process.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/infinitedescent/s-ais/tree/master)

- Fill out the critical data, in the _Config Variables_ section, make sure to read the _description_ for each value if unclear.
- When ready, press the 'Deploy' button to finish the deployment process.
- Once 'Deploy to Heroku' is complete, click the 'Manage App' button and continue with setup.

#### Add and Configure Heroku Scheduler
> Due to a limitation with the _Heroku Scheduler Add-on_, this last step **MUST** be done manually.

- From the 'Overview' tab, click on the 'Heroku Scheduler' link in the 'Configure Add-ons' section.
- Under 'Add-ons', search for ```Heroku Scheduler``` in the textfield.
- Select 'Heroku Scheduler', which will open a dialog box
- Click the 'Provision' button to add the Add-on to your app.
- Open 'Heroku Scheduler' add-on for editing by clicking on it.
- Click the 'Add new job' button, which will open a dialog box.
- In the textfield enter this command: ```node bin/sync```
- Set the 'FREQUENCY' drop down to 'Every 10 minutes.'
- Click the 'Save' button to complete setup.

sAIS is now completely setup!

Verify setup
----------------
To verify sAIS is running correctly you will need to be out of any AIS receiving stations.  Make sure your Garmin/DeLorme device is 'tracking'. Open the 'Detailed View' for your vessel on marinetraffic.com, check the 'Latest Position' area, after the 'AIS Source:' you should see 'SELF' instead of an AIS station number.

Disclaimer
-----
Infinite Descent, creators of _sAIS_ has NO affiliation with Garmin, DeLorme, MarineTraffic, nor Heroku.

_sAIS_ is released as [Donationware](https://en.wikipedia.org/wiki/Donationware) and has **NO GUARANTY** that it will not incur Heroku charges; however, the chances of this are improbable.  The application is designed to use as little processing power as possible, and the application sleeps the majority of the time, only waking up every 10 minutes to check on your location.  However, this website does wake up your Heroku instance and uses a small amount of CPU time each time the website is accessed, so avoid navigating to the App or sharing the URL with others.  Remember, there is no reason to revisit this site other then to check if S-AIS is still functioning.

Make sure you have read the MarineTraffic Disclaimer and Terms of Service.

License
-------
GPL-3.0 © 2017 - [Infinite Descent, LLC](http://infinitedescent.com)
