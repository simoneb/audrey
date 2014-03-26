var socketio = require('socket.io'),
    async = require('async');

function start() {
  var io = socketio.listen(process.env.PORT || 3010, { 'log level': 1 });

  console.log('registry started');

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
                  console.log('No available agent satisfies requirements "%s"', data.cell.requirements);
                } else {
                  console.log('Agent %s satisfies requirements "%s"', agent.id, data.cell.requirements);
                  agent.emit('run', data);
                }
              });
        });
      });
}

module.exports = start;