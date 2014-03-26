var io_client = require('socket.io-client'),
    socketio = require('socket.io'),
    ss = require('socket.io-stream'),
    git = require('./git')
    net = require('./net')
    fs = require('fs'),
    path = require('path'),
    config = require('../audrey.json').server,
    url = require('url');

function start() {
  var io = socketio.listen(config.port);
  console.log('Connecting to registry');
  var registry = io_client.connect(config.registry);
  console.log('Server configuration:');
  console.dir(config);

  registry.on('connect', function(){
    console.log('Connected to registry at %s', config.registry);

    config.repositories.forEach(function(repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        var audreyConfigFile = path.join(repoPath, '.audrey.js');

        if(!fs.existsSync(audreyConfigFile)) {
          console.error("Repository %s does not have a '.audrey.js' configuration file");
          return;
        }

        var audreyConfig = require(audreyConfigFile);

        console.log('Requesting to build %s', repoUrl);

        audreyConfig.matrix.forEach(function(cell) {
          registry.emit('run', {
            repoUrl: repoUrl,
            serverUrls: net.getLocalAddresses().map(function(addr) {
              return 'http://' + addr + ':' + config.port;
            }),
            cell: cell
          });
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