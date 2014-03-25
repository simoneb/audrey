var socketio = require('socket.io');

function start() {
  var io = socketio.listen(3010);

  io.of('/agent')
    .on('connection', function (agent) {
      agent.on('register', function (repositories) {
        console.log('Received agent registration');
        repositories.forEach(function (repo) {
          console.log('Agent %s joining room %s', agent.id, repo);
          agent.join(repo);
        });
      });
      agent.on('unregister', function (data) {
        console.log('Agent %s leaving room %s', agent.id, data.repoUrl);
        agent.leave(data.repoUrl);
      });

      agent.on('disconnect', function() {
        console.log('Agent %s has disconnected', agent.id);
      });
    });

  io.of('/server')
    .on('connection', function (server) {
      server.on('run', function (data) {
        console.log('Received build request for repo %s', data.url);

        var agents = io.of('/agent').clients(data.url);

        if (agents && agents.length) {
          server.emit('agents', { url: data.url, agents: agents.length });

          console.log('Asking agent %s to do the build', agents[0].id);
          agents[0].emit('run', data);
        } else {
          console.log('There are no agents that can build %s', data.url);
          server.emit('noAgents', data.url);
        }
      });
    });
}

module.exports = start;