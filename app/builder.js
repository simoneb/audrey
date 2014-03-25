var spawn = require('child_process').spawn,
  ss = require('socket.io-stream'),
  path = require('path'),
  isWindows = (/windows/i).test(require('os').type());

function startBuild(data, repoPath, socket, callback) {
  var opts = {
    cwd: path.join(process.cwd(), repoPath),
    stdio: 'pipe'
  };

  // don't we need to wrap the command in quotes on windows?
  if (isWindows)
    var command = spawn(process.env.comspec,
      ['/c', data.command.replace('/', "\\")], opts);
  else
    var command = spawn(data.command, [], opts);

  var stream = ss.createStream();
  ss(socket).emit('build', stream);

  command.stderr.pipe(stream);
  command.stdout.pipe(stream);
  command.stderr.pipe(process.stderr);
  command.stdout.pipe(process.stdout);

  command.on('close', function (code) {
    socket.emit('message', 'child process exited with code ' + code);
    callback();
  });
  command.on('error', function (err) {
    socket.emit('message', err.toString());
    console.error(err);
    callback();
  })
}

exports.startBuild = startBuild;