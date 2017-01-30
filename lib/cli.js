#!/usr/bin/env node
'use strict';

const meow = require('meow');
const delormeMarinetrafficSync = require('.');

const cli = meow(`
	Usage
	  $ delorme-marinetraffic-sync [input]

	Options
	  --foo  Lorem ipsum [Default: false]

	Examples
	  $ delorme-marinetraffic-sync
	  unicorns & rainbows
	  $ delorme-marinetraffic-sync ponies
	  ponies & rainbows
`);

console.log(delormeMarinetrafficSync(cli.input[0] || 'unicorns'));
