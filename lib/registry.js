var ioOpts = {
      'log level': 1,
      'transports': ['websocket']
    },
    server = require('./web')('registry'),
    io = require('socket.io').listen(server, ioOpts),
    async = require('async'),
    util = require('util'),
    _ = require('lodash'),
    repos = {},
    agents = {};

function registry(options) {
  server.listen(options.port);
  console.log('Registry started on port %d', options.port);

  function notifyAgentRegistration(agent, reg) {
    clients.emit('agentRegistration', agent.id, reg);

    console.log(util.format('Agent %s registering for %s satisfying requirements "%s"',
        agent.id, reg.repoUrl, reg.requirements));
  }

  var clients = io.of('/client')
      .on('connection', function (client) {
        client.emit('repos', repos);
      });

  var agents = io.of('/agent')
      .on('connection', function (agent) {
        agent.on('register', function (reg) {
          if (agents[agent.id]) {
            agents[agent.id].repoUrls.push(reg.repoUrl);
          } else {
            agents[agent.id] = { repoUrls: [reg.repoUrl], socket: agent };
          }

          if (Object.keys(repos).indexOf(reg.repoUrl) == -1) {
            repos[reg.repoUrl] = {};
          }

          if (!repos[reg.repoUrl][agent.id]) {
            repos[reg.repoUrl][agent.id] = {};
          }

          repos[reg.repoUrl][agent.id].requirements = reg.requirements || [];
          notifyAgentRegistration(agent, reg);
        });

        agent.on('markBusy', function () {
          agents[agent.id].repoUrls.forEach(function (repoUrl) {
            repos[repoUrl][agent.id].busy = true;
          });

          clients.emit('agentBusy', agent.id);
          console.log('Agent %s is now busy', agent.id);
        });

        agent.on('markFree', function () {
          agents[agent.id].repoUrls.forEach(function (repoUrl) {
            repos[repoUrl][agent.id].busy = false;
          });

          clients.emit('agentFree', agent.id);
          console.log('Agent %s is now available', agent.id);
        });

        agent.on('disconnect', function () {
          console.log('Agent %s has disconnected', agent.id);
          clients.emit('agentDisconnected', agent.id);

          agents[agent.id].repoUrls.forEach(function (repoUrl) {
            delete repos[repoUrl][agent.id];
          });
          delete agents[agent.id];
        });
      });

  io.of('/server')
      .on('connection', function (server) {
        server.on('run', function (data) {
          console.log('Received build request for repo %s with requirements %s',
              data.repoUrl, JSON.stringify(data.cell.requirements));

          var agentIds = Object.keys(repos[data.repoUrl] || {});

          async.detect(agentIds, function (agentId, callback) {
                if (repos[data.repoUrl][agentId].busy) {
                  callback(false);
                } else {
                  var diff = _.difference(data.cell.requirements,
                      repos[data.repoUrl][agentId].requirements);

                  callback(!diff.length);
                }
              },
              function (agentId) {
                if (!agentId) {
                  server.emit('noAgents', data.repoUrl, data.cell.requirements);
                  console.log('No available agent satisfies requirements %s',
                      JSON.stringify(data.cell.requirements));
                } else {
                  server.emit('agents', data.repoUrl, data.cell.requirements);
                  console.log('Agent %s satisfies requirements %s',
                      agentId, JSON.stringify(data.cell.requirements));
                  agents[agentId].socket.emit('run', data);
                }
              });
        });
      });
}

module.exports = registry;