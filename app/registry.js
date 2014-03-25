var socketio = require('socket.io'),
    async = require('async');

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function start() {
  var io = socketio.listen(3010);

  io.of('/agent')
      .on('connection', function (agent) {
        agent.on('register', function (registration) {
          if (!registration.requirement) {
            console.log('Agent %s joining room %s', agent.id, registration.repoUrl);
            agent.join(registration.repoUrl);
          } else {
            console.log('Agent %s joining room %s satisfying requirement %s',
                agent.id, registration.repoUrl, registration.requirement);
            agent.set(registration.requirement, true, function () {
              agent.join(registration.repoUrl);
            });
          }
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
                async.every(data.cell.requirements, function(reqName, cb) {
                  console.log('Checking if agent %s satisfies requirement %s', agent.id, reqName);
                  agent.get(reqName, function(err, satisfies) {
                    if(err) cb(false);
                    cb(satisfies);
                  });
                }, callback);
              },
              function (agent) {
                if (!agent) {
                  console.log('No agent satisfies requirements "%s"', data.cell.requirements);
                } else {
                  console.log('Agent %s satisfies requirements "%s"', agent.id, data.cell.requirements);
                  agent.emit('run', data);
                }
              });

          return;

          if (agents && agents.length) {
            server.emit('agents', { url: data.url, agents: agents.length });

            console.log('Asking agent %s to do the build', agents[0].id);
            sample(agents).emit('run', data);
          } else {
            console.log('There are no agents that can build %s', data.url);
            server.emit('noAgents', data.url);
          }
        });
      });
}

module.exports = start;