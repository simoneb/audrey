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

  registry.on('noAgents', function (buildId, cellIndex) {
    clients.emit('cellAgentNotFound', buildId, cellIndex);
  });

  registry.on('agents', function (buildId, cellIndex) {
    clients.emit('cellAgentFound', buildId, cellIndex);
  });

  var clients = io.of('/client').on('connection', function (client) {
    client.emit('repos', options.repositories);

    client.on('runBuild', function (repoUrl, buildId) {
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
    console.log('Received connection from agent %s', agent.id);

    agent.on('cellStarted', function (data, buildId, cellIndex) {
      clients.emit('cellStarted', data, buildId, cellIndex);
    });

    agent.on('cellCompleted', function (buildId, cellIndex) {
      clients.emit('cellCompleted', buildId, cellIndex);
    });

    agent.on('cellMessage', function (message, buildId, cellIndex) {
      clients.emit('cellMessage', message, buildId, cellIndex);
      console.log("Message from %s: %s", agent.id, message);
    });

    agent.on('cellError', function (err, buildId, cellIndex) {
      clients.emit('cellError', err, buildId, cellIndex);
    });

    ss(agent).on('cellBuildLog', function (stream, buildId, cellIndex) {
      stream.setEncoding('utf8');
      stream.pipe(process.stdout);

      stream.on('data', function (chunk) {
        clients.emit('cellBuildLog', chunk, buildId, cellIndex);
      })
    });
  });
}

module.exports = server;