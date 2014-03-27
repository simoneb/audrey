var io_client = require('socket.io-client'),
    socketio = require('socket.io'),
    ss = require('socket.io-stream'),
    git = require('./git')
    net = require('./net')
    fs = require('fs'),
    path = require('path'),
    config = require('../audrey.json').server,
    url = require('url'),
    u = require('./util'),
    registryUrl = "http://audrey.herokuapp.com/server";

function start() {
  var io = socketio.listen(config.port, { 'log level': 1 }),
      registry = io_client.connect(registryUrl);

  console.log('Connecting to registry %s', registryUrl);

  registry.on('connect', function(){
    console.log('Connected to registry');

    config.repositories.forEach(function(repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if(err) throw err;

        u.getAudreyConfig(repoPath, function(err, audreyConfig) {
          if(err) throw err;

          console.log('Requesting to build %s', repoUrl);

          audreyConfig.matrix.forEach(function(cell) {
            registry.emit('run', {
              repoUrl: repoUrl,
              serverUrls: net.getLocalAddresses(true).map(function(addr) {
                return 'http://' + addr + ':' + config.port;
              }),
              cell: cell
            });
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