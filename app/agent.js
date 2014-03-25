var io_client = require('socket.io-client'),
    git = require('./git')
    builder = require('./builder')
    path = require('path'),
    config = require('../audrey.json').agent,
    url = require('url');

function start() {
  console.log('Connecting to registry at %s...', config.registry);
  var registry = io_client.connect(config.registry);

  registry.on('connect', function(){
    console.log('Registering my availability for all repositories');
    registry.emit('register', config.repositories);
  });

  registry.on('error', function(err) {
    console.error('Error when communicating with registry\n%s', err);
  });

  registry.on('run', function(data) {
    console.log('Received request to build %s', data.url);
    var server = io_client.connect(data.serverUrl);

    server.on('connect', function() {
      console.log('Connected to server %s to build %s', data.serverUrl, data.url);
      registry.emit('unregister', { repoUrl: data.url });

      git.pullOrClone(data.url, function(err, repoPath) {
        if(err) {
          server.emit('message', 'Error cloning or updating repo %s: %s', data.url, err);
        }
        builder.startBuild(data, repoPath, server, function() {
          server.disconnect();
        });
      });
    });

    server.on('disconnect', function(){
      console.log('Disconnected from server %s', data.serverUrl);
      registry.emit('register', [data.url]);
    });

    server.on('error', function(err) {
      console.error('Error when communicating with server %s about %s\n%s',
        data.serverUrl, data.url, err);
    });
  });
};

module.exports = start;