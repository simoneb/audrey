var io_client = require('socket.io-client'),
    git = require('./git'),
    os = require('os'),
    fs = require('fs'),
    exec = require('child_process').exec,
    builder = require('./builder'),
    path = require('path'),
    config = require('../audrey.json').agent,
    async = require('async'),
    isWindows = (/windows/i).test(os.type());

function start() {
  console.log('Connecting to registry at %s...', config.registry);
  var registry = io_client.connect(config.registry);

  registry.on('connect', function () {
    console.log('Connected to registry');

    config.repositories.forEach(function (repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        var audreyConfigFile = path.join(repoPath, '.audrey.js');

        if (!fs.existsSync(audreyConfigFile)) {
          throw new Error(audreyConfigFile + ' does not exist');
        }

        var audreyConfig = require(audreyConfigFile);

        if (!audreyConfig.requirements) {
          console.log('Registering without requirements');
          registry.emit('register', { repoUrl: repoUrl });
        } else {
          console.log('Checking requirements');
          for (reqName in audreyConfig.requirements) {
            (function (name) {
              console.log('Checking requirement %s', name);
              async.every(audreyConfig.requirements[name], function (req, callback) {
                switch (req.type) {
                  case 'which':
                    var which = isWindows ? 'where' : 'which';
                    exec(which + ' ' + req.input, function (err, stdo, stde) {
                      callback(!err);
                    });
                    break;
                  case 'cmd':
                    exec(req.input, function (err, stdo, stde) {
                      if (err) callback(false);

                      switch (Object.prototype.toString.call(req.output)) {
                        case '[object RegExp]':
                          callback(req.output.test(stdo.toString()));
                          break;
                        case '[object String]':
                          callback(req.output === stdo.toString());
                          break;
                        default:
                          console.error('Unrecognized cmd requirement output "%s"', req.output);
                          callback(false);
                      }
                    });
                    break;
                  case 'js':
                    console.log('Checking requirement type js');
                    var result = eval(req.input);

                    switch (Object.prototype.toString.call(req.output)) {
                      case '[object RegExp]':
                        var test = req.output.test(result);
                        console.log('Requirement input %s checked against %s: %s',
                            result, req.output, test);
                        callback(test);
                        break;
                      case '[object String]':
                        callback(req.output === result);
                        break;
                      default:
                        console.error('Unrecognized js requirement output "%s"', req.output);
                        callback(false);
                    }
                    break;
                  default:
                    console.error('Unrecognized requirement type "%s"', req.type);
                }
              }, function (satisfied) {
                if (satisfied) {
                  console.log('Requirement "%s" satisfied', name);
                  registry.emit('register', { repoUrl: repoUrl, requirement: name });
                } else {
                  console.log('Requirement "%s" not satisfied', name);
                }
              });
            })(reqName);
          }
        }
      });
    });
  });

  registry.on('error', function (err) {
    console.error('Error when communicating with registry\n%s', err);
  });

  registry.on('run', function (data) {
    console.log('Received request to build %s', data.repoUrl);

    var server = io_client.connect(data.serverUrl, {'force new connection': true });

    server.on('connect', function () {
      console.log('Connected to server %s to build %s', data.serverUrl, data.repoUrl);
      //registry.emit('unregister', { repoUrl: data.repoUrl });

      git.pullOrClone(data.repoUrl, function (err, repoPath) {
        if (err) {
          server.emit('message', 'Error cloning or updating repo %s: %s', data.repoUrl, err);
        }
        builder.startBuild(data, repoPath, server, function () {
          server.disconnect();
        });
      });
    });

    server.on('connect_failed', function () {
      console.error("Couldn't connect to server %s", data.serverUrl);
    });

    server.on('disconnect', function () {
      console.log('Disconnected from server %s', data.serverUrl);
      //registry.emit('register', { repoUrl: data.repoUrl });
    });

    server.on('error', function (err) {
      console.error('Error when communicating with server %s about %s\n%s',
          data.serverUrl, data.url, err);
    });
  });
};

module.exports = start;