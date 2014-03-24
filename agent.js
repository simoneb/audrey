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

  registry.on('pleaseContact', function(data) {
    console.log('Now getting in touch with %s about %s',
      data.serverUrl, data.url);

    var server = io_client.connect(data.serverUrl);

    server.on('connect', function() {
      console.log('Connected to server %s', data.serverUrl);
      server.emit('message', 'Hey man, I\'m going to build ' + data.url +' for you');
    });
  });
};

exports.start = start;