var spawn = require('child_process').spawn,
    fs = require('fs'),
    os = require('os'),
    crypto = require('crypto'),
    ss = require('socket.io-stream'),
    path = require('path'),
    isWindows = (/windows/i).test(os.type());

function startBuild(data, repoPath, socket, callback) {
  var opts = {
        cwd: repoPath,
        stdio: 'pipe'
      },
      randomName = crypto.randomBytes(8).readUInt32LE(0) + '',
      script = path.join(os.tmpdir(), randomName),
      audreyConfigFile = path.join(repoPath, '.audrey.js');

  if(!fs.existsSync(audreyConfigFile)) {
    console.error('No audrey configuration file');
    callback();
    return;
  } else {
    var audreyConfig = require(audreyConfigFile);
  }

  var command = audreyConfig.script.replace(/\$(\w+)/g, function(match, property) {
    return data.cell.env[property];
  });

  console.log('Command to be executed is %s', command);

  if (isWindows)
    script += '.cmd';

  fs.writeFileSync(script, command);
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