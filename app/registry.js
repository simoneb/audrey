var socketio = require('socket.io'),
    async = require('async'),
    http = require('http'),
    git = require('./git');

function registry(options) {
  var server = http.createServer(function(req, res) {
    git.lastCommitShortHash(function(err, hash) {
      if (err)
        res.end("I'm the registry [can't determine version]");
      else
        res.end("I'm the registry, version " + hash);
    });
  });

  var io = socketio.listen(server, {
    'log level': 1,
    'transports': ['websocket']
  });

  server.listen(options.port);

  console.log('Registry started on port %d', options.port);

  io.of('/agent')
      .on('connection', function (agent) {
        agent.on('register', function (registration) {
          if (!registration.requirement) {
            console.log('Agent %s registering for %s', agent.id, registration.repoUrl);
            agent.join(registration.repoUrl);
          } else {
            console.log('Agent %s registering for %s satisfying requirement "%s"',
                agent.id, registration.repoUrl, registration.requirement);
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
        agent.on('unregister', function (data) {
          console.log('Agent %s unregistered for %s', agent.id, data.repoUrl);
          agent.leave(data.repoUrl);
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