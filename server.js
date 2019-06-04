'use strict';

const path = require('path');
const express = require('express');
const stylus = require('stylus');
const nib = require('nib');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');

const routes = require('./routes');

const app = express();

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'pug');

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
