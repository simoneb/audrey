var socketio = require('socket.io'),
    async = require('async');

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function start() {
  var io = socketio.listen(3010, { 'log level': 1 });

  io.of('/agent')
      .on('connection', function (agent) {
        agent.on('register', function (registration) {
          if (!registration.requirement) {
            console.log('Agent %s joining room %s', agent.id, registration.repoUrl);
            agent.join(registration.repoUrl);
          } else {
            console.log('Agent %s joining room %s satisfying requirement "%s"',
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
          console.log('Agent %s leaving room %s', agent.id, data.repoUrl);
          agent.leave(data.repoUrl);
        });

        agent.on('disconnect', function () {
          console.log('Agent %s has disconnected', agent.id);
        });
      });

  io.of('/server')
      .on('connection', function (server) {
        server.on('run', function (data) {
          console.log('Received build request for repo %s', data.repoUrl);

          var agents = io.of('/agent').clients(data.repoUrl);

          async.detect(agents, function (agent, callback) {
                agent.get('_busy', function (err, busy) {
                  if (err || busy) {
                    console.log('Agent %s is busy', agent.id);
                    callback(false);
                  } else {
                    async.every(data.cell.requirements, function (reqName, cb) {
                      console.log('Checking if agent %s satisfies requirement "%s"', agent.id, reqName);
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
                  console.log('No agent satisfies requirements "%s"', data.cell.requirements);
                } else {
                  console.log('Agent %s satisfies requirements "%s"', agent.id, data.cell.requirements);
                  agent.emit('run', data);
                }
              });
        });
      });
}

module.exports = start;