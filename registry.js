var socketio = require('socket.io');

function start() {
  var io = socketio.listen(3010);

  io.on('connection', function (socket) {
    socket.on('giveMe', function (data) {
      var server = socket;
      console.log('Received request for repo %s', data.url)

      var agents = io.sockets.clients(data.url);

      if (agents && agents.length) {
        server.emit('agents', { url: data.url, agents: agents.length });
        agents[0].emit('pleaseContact', {
          url: data.url,
          serverUrl: data.serverUrl
        });
      } else {
        server.emit('noAgents', data.url);
      }
    });

    socket.on('register', function (repos) {
      console.log('Received agent registration');
      repos.forEach(function (repo) {
        console.log('Joining room for %s', repo);
        socket.join(repo);
      });
    });
  });
}

exports.start = start;