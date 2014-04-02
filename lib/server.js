var io_client = require('socket.io-client'),
    socketio = require('socket.io'),
    ss = require('socket.io-stream'),
    git = require('./git'),
    net = require('./net'),
    path = require('path'),
    async = require('async'),
    u = require('./util'),
    util = require('util'),
    http_server = require('./web')('server'),
    io = socketio.listen(http_server, { 'log level': 1 }),
    agentToBuild = {};

function server(options) {
  var registryUrl = u.registryUrl(options.registry, 'server'),
      port = options.port,
      registry = io_client.connect(registryUrl);

  http_server.listen(port);

  console.log('Server listening on port %d', port);

  if (options.address) {
    console.log('Forcing address for agent connection to %s', options.address);
  } else {
    console.log('Address for agent connection will be determined using local network interfaces');
  }

  console.log('Connecting to registry %s...', registryUrl);

  registry.on('connect', function () {
    console.log('Connected to registry');

    async.eachSeries(options.repositories, function (repoUrl, repoCallback) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if (err) return repoCallback(err);

        u.getAudreyConfig(repoPath, function (err, audreyConfig) {
          if (err) return repoCallback(err);

          console.log('Requesting to build %s', repoUrl);

          audreyConfig.matrix.forEach(function (cell) {
            registry.emit('run', {
              repoUrl: repoUrl,
              serverUrls: (options.address ?
                  [options.address + '/agent'] : net.getLocalAddresses(true)).map(function (addr) {
                    return util.format('http://%s:%d/agent', addr, port);
                  }),
              cell: cell
            });
          });

          repoCallback();
        });
      });
    });
  });

  registry.on('noAgents', function (repoUrl, requirements) {
    console.log('No available agent for requirements %s for %s',
        JSON.stringify(requirements), repoUrl);
  });

  registry.on('agents', function (repoUrl, requirements) {
    console.log('Found available agent for requirements %s for %s',
        JSON.stringify(requirements), repoUrl);
  });

  var clients = io.of('/client').on('connection', function (client) {
    client.emit('repos', options.repositories);
  });

  io.of('/agent').on('connection', function (agent) {
    var buildId = u.randomString(12);
    console.log('Received connection from agent %s', agent.id);

    clients.emit('agentConnected', agent.id, buildId);

    agent.on('buildStarted', function (data) {
      clients.emit('buildStarted', data, buildId);
    });

    agent.on('buildCompleted', function () {
      clients.emit('buildCompleted', buildId);
    });

    agent.on('message', function (message) {
      clients.emit('message', message, buildId);
      console.log("Message from %s: %s", agent.id, message);
    });

    agent.on('buildError', function(err) {
      clients.emit('buildError', err, buildId);
    });

    ss(agent).on('build', function (stream) {
      stream.setEncoding('utf8');
      stream.pipe(process.stdout);

      stream.on('data', function(chunk) {
        clients.emit('build', chunk, buildId);
      })
    });

    agent.on('disconnect', function () {
      clients.emit('agentDisconnected', agent.id,  buildId);
      console.log('Agent %s disconnected', agent.id);
    });
  });
}

module.exports = server;