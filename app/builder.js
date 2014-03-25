var spawn = require('child_process').spawn,
    path = require('path'),
    isWindows = (/windows/i).test(require('os').type());

function startBuild(data, repoPath, socket, callback) {
  var cwd = path.join(process.cwd(), repoPath);

  // don't we need to wrap the command in quotes on windows?
  if(isWindows)
    var command = spawn(process.env.comspec,
      ['/c', data.command.replace('/', "\\")], { cwd: cwd });
  else
    var command = spawn(data.command, [], { cwd: cwd });

  command.stderr.setEncoding('utf8');
  command.stdout.setEncoding('utf8');

  command.stdout.on('data', function(data) {
    console.log(data);
    socket.emit('message', data);
  });
  command.stderr.on('data', function(data) {
    console.error(data);
    socket.emit('message', data);
  });
  command.on('close', function(code) {
    socket.emit('message', 'child process exited with code ' + code);
    callback();
  });
  command.on('error', function(err) {
    socket.emit('message', err.toString());
    console.error(err);
    callback();
  })
}

exports.startBuild = startBuild;