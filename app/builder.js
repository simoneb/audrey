var spawn = require('child_process').spawn,
    fs = require('fs'),
    os = require('os'),
    crypto = require('crypto'),
    ss = require('socket.io-stream'),
    path = require('path'),
    u = require('./util');

function startBuildWithConfig(data, repoPath, socket, callback, config) {
  var randomName = crypto.randomBytes(8).readUInt32LE(0) + '',
      tempScript = path.join(os.tmpdir(), randomName),
      scriptContents = config.script.replace(/\$(\w+)/g, function (match, property) {
        return data.cell.env[property];
      });

  console.log('Command to be executed is %s', scriptContents);

  if (u.isWindows)
    tempScript += '.cmd';

  fs.writeFile(tempScript, scriptContents, { mode: 493 }, function(err) {
    if(err) throw err;

    var command = spawn(tempScript, [], {
      cwd: repoPath,
      stdio: 'pipe'
    });

    var stream = ss.createStream();
    ss(socket).emit('build', stream);

    command.stderr.pipe(stream);
    command.stdout.pipe(stream);
    //command.stderr.pipe(process.stderr);
    //command.stdout.pipe(process.stdout);

    command.on('close', function (code) {
      socket.emit('message', 'child process exited with code ' + code);
      callback();
    });
    command.on('error', function (err) {
      socket.emit('message', err.toString());
      console.error(err);
      callback();
    });
  });
}

function startBuild(data, repoPath, socket, callback) {
  u.getAudreyConfig(repoPath, function (err, config) {
    if (err) throw err;

    startBuildWithConfig(data, repoPath, socket, callback, config);
  });
}

exports.startBuild = startBuild;