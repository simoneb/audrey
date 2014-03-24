var io_client = require('socket.io-client'),
    socketio = require('socket.io'),
    git = require('./git')
    path = require('path'),
    config = require('./config').server,
    url = require('url'),
    yaml = require('yaml'),
    repositories = {};

function start() {
  var io = socketio.listen(3011);
  console.log('Connecting to registry');
  var registry = io_client.connect(config.registry);
  console.log('Server configuration:');
  console.dir(config);

  function makeBuildRequest(url) {
    return function() {
      console.log('Requesting agents for %s', url);

      registry.emit('giveMe', {
        url: url,
        serverUrl: 'http://localhost:3011'
      });
    };
  }

  registry.on('connect', function(){
    console.log('Connected to registry at %s', config.registry);

    config.repositories.forEach(function(r) {
      var repo = repositories[r] = {
        url: r,
        path: path.join('.audrey', 'repos', url.parse(r).pathname.substring(1))
      };

      git.pullOrClone(repo.url, repo.path, makeBuildRequest(repo.url));
    });
  });

  registry.on('noAgents', function(url){
    console.log('There are no agents that can build %s', url);
  });

  registry.on('agents', function(data){
    console.log('There are available agents for %s:', data.url);
    console.dir(data.agents);
  });

  io.on('connection', function(socket) {
    socket.on('message', function(message) {
      console.log("message from %s: %s", socket.id, message);
    });
  });

};

exports.start = start;