var express = require('express'),
    ioOpts = {
      'log level': 1,
      'transports': ['websocket']
    },
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server, ioOpts),
    async = require('async'),
    path = require('path'),
    util = require('util'),
    git = require('./git'),
    routes = require('../routes');

function registry(options) {
  app.configure(function () {
    app.set('views', __dirname + '/../views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, '..', 'public')));
  });

  app.configure('development', function () {
    app.use(express.errorHandler());
  });

  app.get('/', routes.index);

  server.listen(options.port);
  console.log('Registry started on port %d', options.port);

  function notifyAgentRegistration(agent, registration) {
    var message = util.format('Agent %s registering for %s satisfying requirement "%s"',
        agent.id, registration.repoUrl, registration.requirement);

    clients.emit('message', message);
    console.log(message);
  }

  var clients = io.of('/client')
      .on('connection', function (client) {
        client.emit('message', 'Hey there');
      });

  io.of('/agent')
      .on('connection', function (agent) {
        agent.on('register', function (registration) {
          if (!registration.requirement) {
            console.log('Agent %s registering for %s', agent.id, registration.repoUrl);
            agent.join(registration.repoUrl);
          } else {
            notifyAgentRegistration(agent, registration);

            agent.set(registration.requirement, true, function () {
              agent.join(registration.repoUrl);
            });
          }
        });

        agent.on('markBusy', function () {
          agent.set('_busy', true, function () {
            console.log('Agent %s is now busy', agent.id);
          });
        });

        agent.on('markFree', function () {
          agent.set('_busy', false, function () {
            console.log('Agent %s is now available', agent.id);
          });
        });

        agent.on('disconnect', function () {
          console.log('Agent %s has disconnected', agent.id);
        });
      });

  io.of('/server')
      .on('connection', function (server) {
        server.on('run', function (data) {
          console.log('Received build request for repo %s with requirements %s',
              data.repoUrl, JSON.stringify(data.cell.requirements));

          var agents = io.of('/agent').clients(data.repoUrl);

          async.detect(agents, function (agent, callback) {
                agent.get('_busy', function (err, busy) {
                  if (err || busy) {
                    callback(false);
                  } else {
                    async.every(data.cell.requirements, function (reqName, cb) {
                      agent.get(reqName, function (err, satisfies) {
                        if (err) cb(false);
                        cb(satisfies);
                      });
                    }, callback);
                  }
                });
              },
              function (agent) {
                if (!agent) {
                  server.emit('noAgents', data.repoUrl, data.cell.requirements);
                  console.log('No available agent satisfies requirements %s',
                      JSON.stringify(data.cell.requirements));
                } else {
                  server.emit('agents', data.repoUrl, data.cell.requirements);
                  console.log('Agent %s satisfies requirements %s',
                      agent.id, JSON.stringify(data.cell.requirements));
                  agent.emit('run', data);
                }
              });
        });
      });
}

module.exports = registry;