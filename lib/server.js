var io_client = require('socket.io-client'),
    socketio = require('socket.io'),
    ss = require('socket.io-stream'),
    git = require('./git'),
    net = require('./net'),
    path = require('path'),
    u = require('./util'),
    util = require('util');

function server(options) {
  var registryUrl = u.registryUrl(options.registry, 'server'),
      port = options.port,
      io = socketio.listen(port, { 'log level': 1 }),
      registry = io_client.connect(registryUrl);

  console.log('Server listening on port %d', port);

  if(options.address) {
    console.log('Forcing address for agent connection to %s', options.address);
  } else {
    console.log('Address for agent connection will be determined using local network interfaces');
  }

  console.log('Connecting to registry %s...', registryUrl);

  registry.on('connect', function () {
    console.log('Connected to registry');

    options.repositories.forEach(function (repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if (err) throw err;

        u.getAudreyConfig(repoPath, function (err, audreyConfig) {
          if (err) throw err;

          console.log('Requesting to build %s', repoUrl);

          audreyConfig.matrix.forEach(function (cell) {
            registry.emit('run', {
              repoUrl: repoUrl,
              serverUrls: (options.address ?
                  [options.address] : net.getLocalAddresses(true)).map(function (addr) {
                    return util.format('http://%s:%d', addr, port);
                  }),
              cell: cell
            });
          });
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

  io.on('connection', function (agent) {
    console.log('Received connection from agent %s', agent.id);

    agent.on('message', function (message) {
      console.log("Message from %s: %s", agent.id, message);
    });

    ss(agent).on('build', function (stream) {
      stream.pipe(process.stdout);
    });

    agent.on('disconnect', function () {
      console.log('Agent %s disconnected', agent.id);
    });
  });

};

module.exports = server;