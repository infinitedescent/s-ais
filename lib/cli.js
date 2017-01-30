#!/usr/bin/env node
'use strict';
const meow = require('meow');
const sAis = require('.');

const cli = meow(`
	Usage
	  $ s-ais [input]

	Options
	  --foo  Lorem ipsum [Default: false]

	Examples
	  $ s-ais
	  unicorns & rainbows
	  $ s-ais ponies
	  ponies & rainbows
`);

console.log(sAis(cli.input[0] || 'unicorns'));
