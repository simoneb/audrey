var io_client = require('socket.io-client'),
    socketio = require('socket.io'),
    ss = require('socket.io-stream'),
    git = require('./git')
    path = require('path'),
    config = require('../audrey.json').server,
    url = require('url'),
    yaml = require('yaml');

function start() {
  var io = socketio.listen(parseInt(url.parse(config.url).port));
  console.log('Connecting to registry');
  var registry = io_client.connect(config.registry);
  console.log('Server configuration:');
  console.dir(config);

  registry.on('connect', function(){
    console.log('Connected to registry at %s', config.registry);

    config.repositories.forEach(function(repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        console.log('Requesting to build %s', repoUrl);
        registry.emit('run', {
          url: repoUrl,
          serverUrl: config.url,
          command: './runbuild'
        });
      });
    });
  });

  registry.on('noAgents', function(url){
    console.log('There are no agents that can build %s', url);
  });

  registry.on('agents', function(data){
    console.log('There are available agents for %s: %d', data.url, data.agents);
  });

  io.on('connection', function(agent) {
    console.log('Received connection from agent %s', agent.id);

    agent.on('message', function(message) {
      console.log("Message from %s: %s", agent.id, message);
    });

    ss(agent).on('build', function(stream) {
      stream.pipe(process.stdout);
    });

    agent.on('disconnect', function() {
      console.log('Agent %s disconnected', agent.id);
    });
  });

};

module.exports = start;