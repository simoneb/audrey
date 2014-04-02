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
    debug = require('debug')('audrey:server'),
    io = socketio.listen(http_server, { 'log level': 1 });

function getServerUrls(address, port) {
  return (address ? [address + '/agent'] : net.getLocalAddresses(true))
      .map(function (addr) {
        return util.format('http://%s:%d/agent', addr, port);
      });
}

function server(options) {
  var registryUrl = u.registryUrl(options.registry, 'server'),
      port = options.port,
      serverUrls = getServerUrls(options.address, port),
      registry = io_client.connect(registryUrl);

  http_server.listen(port);

  console.log('Server listening on port %d', port);

  if (options.address) {
    debug('Forcing address for agent connection to %s', options.address);
  } else {
    debug('Address for agent connection will be determined using local network interfaces');
  }

  console.log('Connecting to registry %s...', registryUrl);

  registry.on('connect', function () {
    console.log('Connected to registry, ready');
  });
  registry.on('noAgents', function (buildId, cellIndex) {
    clients.emit('cellAgentNotFound', buildId, cellIndex);
  });
  registry.on('agents', function (buildId, cellIndex) {
    clients.emit('cellAgentFound', buildId, cellIndex);
  });

  var clients = io.of('/client').on('connection', function (client) {
    client.emit('repos', options.repositories);

    client.on('runBuild', function (repoUrl, buildId) {
      debug('Received request to build %s, id %s', repoUrl, buildId);

      git.pullOrClone(repoUrl, function (err, stdo, stderr, repoPath) {
        if (stdo) clients.emit('buildMessage', stdo, buildId);
        if (stderr) clients.emit('buildMessage', stderr, buildId);

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
            }, buildId, index);
          });
        });
      });
    });
  });

  io.of('/agent').on('connection', function (agent) {
    debug('Received connection from agent %s', agent.id);

    agent.on('cellStarted', function (data, buildId, cellIndex) {
      clients.emit('cellStarted', data, buildId, cellIndex);
    });

    agent.on('cellCompleted', function (buildId, cellIndex) {
      clients.emit('cellCompleted', buildId, cellIndex);
    });

    agent.on('cellMessage', function (message, buildId, cellIndex) {
      clients.emit('cellMessage', message, buildId, cellIndex);
    });

    agent.on('cellError', function (err, buildId, cellIndex) {
      clients.emit('cellError', err, buildId, cellIndex);
    });

    ss(agent).on('cellBuildLog', function (stream, buildId, cellIndex) {
      stream.setEncoding('utf8');
      stream.on('data', function (chunk) {
        clients.emit('cellBuildLog', chunk, buildId, cellIndex);
      })
    });
  });
}

module.exports = server;