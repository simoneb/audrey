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
    io = socketio.listen(http_server, { 'log level': 1 });

function server(options) {
  var registryUrl = u.registryUrl(options.registry, 'server'),
      port = options.port,
      serverUrls = (options.address ?
          [options.address + '/agent'] :
          net.getLocalAddresses(true)).map(function (addr) {
            return util.format('http://%s:%d/agent', addr, port);
          }),
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
  });

  registry.on('noAgents', function (data, matrixId) {
    var message = util.format('No available agent for requirements %s for %s',
        JSON.stringify(data.cell.requirements), data.repoUrl);
    clients.emit('matrixMessage', message, matrixId);
    console.log(message);
  });

  registry.on('agents', function (data, buildId) {
    var message = util.format('Found available agent for requirements %s for %s',
        JSON.stringify(data.cell.requirements), data);

    clients.emit('message', message, buildId);
    console.log(message);
  });

  var clients = io.of('/client').on('connection', function (client) {
    client.emit('repos', options.repositories);

    client.on('runBuild', function (repoUrl, buildId) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if (err) return clients.emit('buildError', err, buildId);

        u.getAudreyConfig(repoPath, function (err, audreyConfig) {
          if (err) return clients.emit('buildError', err, buildId);

          clients.emit('buildMessage', 'Requesting to build ' + repoUrl, buildId);

          audreyConfig.matrix.forEach(function (cell, index) {
            clients.emit('buildMatrix', cell, index, buildId);
            registry.emit('run', {
              repoUrl: repoUrl,
              serverUrls: serverUrls,
              cell: cell
            }, { id: buildId, matrixIndex: index });
          });
        });
      });
    });
  });

  io.of('/agent').on('connection', function (agent) {
    console.log('Received connection from agent %s', agent.id);

    clients.emit('agentConnected', agent.id);

    agent.on('matrixStarted', function (data, matrixId) {
      clients.emit('matrixStarted', data, matrixId);
    });

    agent.on('matrixCompleted', function (buildId) {
      clients.emit('matrixCompleted', buildId);
    });

    agent.on('matrixMessage', function (message, matrixId) {
      clients.emit('matrixMessage', message, matrixId);
      console.log("Message from %s: %s", agent.id, message);
    });

    agent.on('matrixError', function (err, matrixId) {
      clients.emit('matrixError', err, matrixId);
    });

    ss(agent).on('matrixBuild', function (stream, matrixId) {
      stream.setEncoding('utf8');
      stream.pipe(process.stdout);

      stream.on('data', function (chunk) {
        clients.emit('matrixBuild', chunk, matrixId);
      })
    });

    agent.on('disconnect', function () {
      clients.emit('agentDisconnected', agent.id);
      console.log('Agent %s disconnected', agent.id);
    });
  });
}

module.exports = server;