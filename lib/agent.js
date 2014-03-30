var io_client = require('socket.io-client'),
    git = require('./git'),
    os = require('os'),
    _ = require('lodash'),
    net = require('./net'),
    exec = require('child_process').exec,
    builder = require('./builder'),
    path = require('path'),
    async = require('async'),
    Table = require('cli-table'),
    u = require('./util');

function checkCommandOutput(command, result, callback) {
  var err = new Error(),
      matchType = /\[object (\w+)\]/.exec(
          Object.prototype.toString.call(command.match))[1];

  switch (matchType) {
    case 'RegExp':
      var test = command.match.test(result);
      callback(test ? null : err, {
        command: command.match + '.test("' + result + '")',
        output: test
      });
      break;
    case 'String':
    case 'Number':
      var equal = command.match === result;
      callback(equal ? null : err, {
        command: '"' + command.match + '" === "' + result + '"',
        output: equal
      });
      break;
    default:
      callback(err, {
        command: 'unrecognized match type ' + matchType,
        output: command.match
      });
  }
}

function checkRequirement(req, reqCallback) {
  async.mapSeries(req.commands, function (command, cmdCallback) {
    switch (command.type) {
      case 'which':
        var cmd = u.which + ' ' + command.input;
        exec(cmd, function (err, stdo) {
          cmdCallback(err, { output: err, command: cmd });
        });
        break;
      case 'cmd':
        exec(command.input, function (err, stdo) {
          if (err) {
            cmdCallback(err, { output: err, command: command.input });
          } else {
            checkCommandOutput(command, stdo.toString(), cmdCallback);
          }
        });
        break;
      case 'js':
        try {
          var result = eval(command.input);
        } catch (err) {
          cmdCallback(err, { command: 'eval(' + command.input + ')', output: err });
        }
        checkCommandOutput(command, result, cmdCallback);
        break;
      default:
        cmdCallback(new Error(), { command: 'unrecognized command type ' + command.type });
    }
  }, function (err, results) {
    reqCallback(null, { name: req.name, ok: !err, results: results });
  });
}

function runBuild(serverUrl, data, registry) {
  var server = io_client.connect(serverUrl, {'force new connection': true });

  registry.emit('markBusy');

  server.on('connect', function () {
    console.log('Connected to server %s to build %s', serverUrl, data.repoUrl);

    git.pullOrClone(data.repoUrl, function (err, repoPath) {
      if (err)
        return server.emit('message', 'Error cloning or updating repo %s\n%s', data.repoUrl, err);

      builder.startBuild(data, repoPath, server, function (err) {
        console.log('Build completed');
        server.disconnect();
        registry.emit('markFree');
      });
    });
  });

  server.on('connect_failed', function () {
    console.error("Couldn't connect to server %s", serverUrl);
    registry.emit('markFree');
  });

  server.on('disconnect', function () {
    console.log('Disconnected from server %s', serverUrl);
  });

  server.on('error', function (err) {
    console.error('Error when communicating with server %s about %s\n%s',
        serverUrl, data.repoUrl, err);
    registry.emit('markFree');
  });
}

function agent(options) {
  if (!options.repositories.length)
    return console.error('There are no repositories to build');

  var registryUrl = u.registryUrl(options.registry, 'agent'),
      registry = io_client.connect(registryUrl, { 'log level': 1 });

  console.log('Connecting to registry %s...', registryUrl);

  registry.on('connect', function () {
    console.log('Connected to registry');

    async.eachSeries(options.repositories, function (repoUrl, repoCallback) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if (err) return repoCallback(err);

        u.getAudreyConfig(repoPath, function (err, config) {
          if (err) return repoCallback(err);

          if (!config.requirements) {
            console.log('Ready to accept build requests for %s', repoUrl);
            registry.emit('register', { repoUrl: repoUrl, requirements: [] });
            repoCallback();
          } else {
            async.mapSeries(Object.keys(config.requirements), function (reqName, callback) {
              checkRequirement({ name: reqName, commands: config.requirements[reqName] }, callback);
            }, function (err, results) {
              console.log('Requirements summary for %s', repoUrl);

              var table = new Table({
                head: ['Requirement', 'Satisfied', 'Failing command', 'Output'],
                style: { head: ['cyan'] }
              });

              table.push.apply(table, results.sort(function (a, b) {
                if (a.ok && b.ok || !(a.ok || b.ok))
                  return a.name < b.name ? -1 : 1;

                return a.ok ? -1 : 1;
              }).map(function (result) {
                    var lastCmd = result.results[result.results.length - 1];

                    return [result.name,
                      result.ok,
                      result.ok ? '' : lastCmd.command || '',
                      result.ok ? '' : lastCmd.output === false ? false : lastCmd.output || ''
                    ];
                  }));

              console.log(table.toString());

              registry.emit('register', {
                repoUrl: repoUrl,
                requirements: _.chain(results).filter('ok').map('name').value()
              });

              console.log('Ready to accept build requests for %s', repoUrl);
              repoCallback();
            });
          }
        });
      });
    });
  });

  registry.on('error', function (err) {
    throw err;
  });

  registry.on('run', function (data) {
    console.log('Received request to build %s', data.repoUrl);

    net.firstReachableUrl(data.serverUrls, function (serverUrl) {
      if (serverUrl) {
        runBuild(serverUrl, data, registry);
      } else {
        console.error("Couldn't reach server at any of the attempted urls");
      }
    });
  });
}

module.exports = agent;