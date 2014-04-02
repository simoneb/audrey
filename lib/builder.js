var spawn = require('child_process').spawn,
    fs = require('fs'),
    os = require('os'),
    crypto = require('crypto'),
    ss = require('socket.io-stream'),
    path = require('path'),
    u = require('./util'),
    debug = require('debug')('audrey:builder');

function startBuildWithConfig(data, repoPath, server, config, buildId, cellIndex, callback) {
  var randomName = crypto.randomBytes(8).readUInt32LE(0) + '',
      tempScript = path.join(os.tmpdir(), randomName),
      scriptContents = config.script.replace(/\$(\w+)/g, function (match, property) {
        return config.matrix[cellIndex].env[property];
      });

  server.emit('cellMessage', 'Command to be executed is ' + scriptContents, buildId, cellIndex);
  debug('Command to be executed is %s', scriptContents);

  if (u.isWindows)
    tempScript += '.cmd';

  fs.writeFile(tempScript, scriptContents, { mode: 493 }, function (err) {
    if (err) return callback(err);

    var timeout = data.cell.timeout || config.timeout || 180,
        start = new Date(),
        command = spawn(tempScript, [], {
          cwd: repoPath,
          stdio: 'pipe'
        }),
        timeoutCheck = setInterval(function () {
          if (((new Date() - start) / 1000) > timeout) {
            server.emit('cellMessage', 'Terminating build due to timeout', buildId, cellIndex);
            debug('Terminating build due to timeout');
            command.kill();
          }
        }, 10 * 1000);

    var stream = ss.createStream();
    ss(server).emit('cellBuildLog', stream, buildId, cellIndex);

    command.stderr.pipe(stream);
    command.stdout.pipe(stream);

    command.on('exit', function (code, signal) {
      clearTimeout(timeoutCheck);
      server.emit('cellMessage', 'Child process exited with code ' + code + ' and signal ' + signal, buildId, cellIndex);
      callback();
    });
    command.on('error', function (err) {
      clearTimeout(timeoutCheck);
      console.error(err);
      callback(err);
    });
  });
}

function startBuild(data, repoPath, server, buildId, cellIndex, callback) {
  u.getAudreyConfig(repoPath, function (err, config) {
    if (err) return callback(err);

    startBuildWithConfig(data, repoPath, server, config, buildId, cellIndex, callback);
  });
}

exports.startBuild = startBuild;