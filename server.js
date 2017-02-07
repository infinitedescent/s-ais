'use strict';

var path = require('path');
var express = require('express');
var stylus = require('stylus');
var nib = require('nib');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

var routes = require('./routes');

var app = express();

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'jade');

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(stylus.middleware(
	{
		src: path.join(__dirname, '/public'),
		compile: (str, path) => {
			return stylus(str)
				.set('filename', path)
				.use(nib());
		}
	}
));
app.use(express.static(path.join(__dirname, '/public')));

app.get('/', routes.index);
app.get('/welcome', routes.welcome);

app.listen(app.get('port'), () => {
	console.log('Node app is running at localhost:' + app.get('port'));
});

if (app.get('env') === 'development') {
	app.locals.pretty = true;
}
