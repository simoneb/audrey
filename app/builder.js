var spawn = require('child_process').spawn,
  fs = require('fs'),
  crypto = require('crypto'),
  ss = require('socket.io-stream'),
  path = require('path'),
  isWindows = (/windows/i).test(require('os').type());

function startBuild(data, repoPath, socket, callback) {
  var opts = {
      cwd: path.join(process.cwd(), repoPath),
      stdio: 'pipe'
    },
    script = path.join(process.env.TMP || process.env.TMPDIR || '/tmp',
      crypto.randomBytes(8).readUInt32LE(0) + '');

  if(isWindows)
    script += '.cmd';

  fs.writeFileSync(script, data.command);
  fs.chmodSync(script, '755');

  var command = spawn(script, [], opts);

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