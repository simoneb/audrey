var io_client = require('socket.io-client'),
    git = require('./git')
    path = require('path'),
    config = require('./config').agent,
    url = require('url'),
    repositories = {};

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
    var server = io_client.connect(data.serverUrl);

    server.on('connect', function() {
      console.log('Connected to server %s to build %s', data.serverUrl, data.url);
      server.send('Build of ' + data.url +' successful');
      server.disconnect();
    });

    server.on('disconnect', function(){
      console.log('Disconnected from server %s', data.serverUrl);
    });

    server.on('error', function(err) {
      console.error('Error when communicating with server %s about %s\n%s',
        data.serverUrl, data.url, err);
    });
  });
};

exports.start = start;