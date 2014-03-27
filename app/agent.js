var io_client = require('socket.io-client'),
    git = require('./git'),
    os = require('os'),
    net = require('./net'),
    exec = require('child_process').exec,
    builder = require('./builder'),
    path = require('path'),
    config = require('../audrey.json').agent,
    async = require('async'),
    u = require('./util'),
    registryUrl = "http://audrey.herokuapp.com/agent";

function checkRequirement(registry, reqName, requirement, repoUrl) {
  console.log('Checking satisfiability of requirement "%s"', reqName);

  async.every(requirement, function (req, callback) {
    switch (req.type) {
      case 'which':
        console.log('Checking requirement type "which"');

        exec(u.which + ' ' + req.input, function (err) {
          callback(!err);
        });
        break;
      case 'cmd':
        console.log('Checking requirement type "cmd"');

        exec(req.input, function (err, stdo) {
          if (err) callback(false);

          switch (Object.prototype.toString.call(req.output)) {
            case '[object RegExp]':
              callback(req.output.test(stdo.toString()));
              break;
            case '[object String]':
              callback(req.output === stdo.toString());
              break;
            default:
              console.error('Unrecognized cmd requirement output type "%s"', req.output);
              callback(false);
          }
        });
        break;
      case 'js':
        console.log('Checking requirement type "js"');
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
            console.error('Unrecognized js requirement output type "%s"', req.output);
            callback(false);
        }
        break;
      default:
        console.error('Unrecognized requirement type "%s"', req.type);
        callback(false);
    }
  }, function (satisfied) {
    if (satisfied) {
      console.log('Requirement "%s" satisfied', reqName);
      registry.emit('register', { repoUrl: repoUrl, requirement: reqName });
    } else {
      console.log('Requirement "%s" not satisfied', reqName);
    }
  });
}

function runBuild(serverUrl, data, registry) {
  var server = io_client.connect(serverUrl, {'force new connection': true });

  registry.emit('markBusy');

  server.on('connect', function () {
    console.log('Connected to server %s to build %s', serverUrl, data.repoUrl);

    git.pullOrClone(data.repoUrl, function (err, repoPath) {
      if (err) {
        server.emit('message', 'Error cloning or updating repo %s\n%s', data.repoUrl, err);
      }
      builder.startBuild(data, repoPath, server, function () {
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

function start() {
  console.log('Connecting to registry %s...', registryUrl);
  var registry = io_client.connect(registryUrl, { 'log level': 1 });

  registry.on('connect', function () {
    console.log('Connected to registry');

    config.repositories.forEach(function (repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if (err) throw err;

        u.getAudreyConfig(repoPath, function (err, config) {
          if (err) throw err;

          if (!config.requirements) {
            console.log('Registering without requirements');
            registry.emit('register', { repoUrl: repoUrl });
          } else {
            console.log('Checking requirements');

            for (var reqName in config.requirements) {
              checkRequirement(registry, reqName, config.requirements[reqName], repoUrl);
            }
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

module.exports = start;