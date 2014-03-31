var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    routes = require('../routes'),
    path = require('path');

app.configure(function () {
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(process.cwd(), 'public')));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

module.exports = function(rootRoute) {
  app.use('/', routes[rootRoute]);
  return server;
};