'use strict';

/*
 * GET home page.
 */
exports.index = function (req, res) {
	res.render('index',
		{
			section: 'home',
			title: 'Home'
		}
	);
};

exports.welcome = function (req, res) {
	res.render('welcome',
		{title: 'Welcome'}
	);
};
