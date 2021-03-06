require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  require('newrelic');
}

const express = require('express');
const path = require('path');
const traceurl = require('@catchen/traceurl');

const CATCHEN_APP_HOSTNAME_PATTERN = /\.catchen\.app$/;
const NETLIFY_DEPLOY_PREVIEW_HOSTNAME_PATTERN = /deploy-preview-\d+--traceurl\.netlify\.com$/;

var app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').json());
app.use(require('body-parser').urlencoded({ extended: false }));
app.use(require('serve-static')(path.join(__dirname, 'public')));
app.use(require('errorhandler')());

app.engine('mustache', require('mustache-express')());
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

app.get('/', function(request, response) {
  response.render('index');
});

app.get('/resolve.:format?', function(request, response) {
  const format = request.params.format || 'html';
  const hops = request.query.hops === 'true';
  const origin = request.get('Origin');
  console.log(
    'format = ' + format + ', hops = ' + hops + ', origin = ' + origin,
  );

  if (process.env.NODE_ENV === 'development') {
    response.set({
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
    });
  } else if (format === 'json' || format === 'xml') {
    if (origin) {
      const originURL = new URL(origin);
      if (
        originURL.hostname.match(CATCHEN_APP_HOSTNAME_PATTERN) ||
        originURL.hostname.match(NETLIFY_DEPLOY_PREVIEW_HOSTNAME_PATTERN)
      ) {
        response.set({
          'Access-Control-Allow-Origin': originURL.origin,
          'Timing-Allow-Origin': originURL.origin,
        });
      }
    }
  }

  if (hops) {
    traceurl.traceHops(request.query.url).addCallback(function(results) {
      var json = { urls: results };
      switch (format) {
        case 'json':
          response.contentType('application/json');
          response.render('resolve.json.mustache', {
            json: JSON.stringify(json),
          });
          break;
        case 'xml':
          response.contentType('application/xml');
          response.render('resolve.xml.mustache', json);
          break;
        case 'html':
        case undefined:
          if (!request.header('X-Requested-With')) {
            response.render('resolve', json);
          } else {
          }
          break;
        default:
          response.send(404);
          break;
      }
    });
  } else {
    traceurl.trace(request.query.url).addCallback(function(result) {
      var json = { url: result || '' };
      switch (format) {
        case 'json':
          response.contentType('application/json');
          response.render('resolve.json.mustache', {
            json: JSON.stringify(json),
          });
          break;
        case 'xml':
          response.contentType('application/xml');
          response.render('resolve.xml.mustache', json);
          break;
        case 'html':
        case undefined:
          if (!request.header('X-Requested-With')) {
            response.render('resolve', json);
          } else {
          }
          break;
        default:
          response.send(404);
          break;
      }
    });
  }
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
