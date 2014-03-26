var io_client = require('socket.io-client'),
    git = require('./git'),
    os = require('os'),
    fs = require('fs'),
    net = require('net'),
    url = require('url'),
    exec = require('child_process').exec,
    builder = require('./builder'),
    path = require('path'),
    config = require('../audrey.json').agent,
    async = require('async'),
    isWindows = (/windows/i).test(os.type()),
    which = isWindows ? 'where' : 'which';

function checkRequirement(registry, reqName, requirement, repoUrl) {
  console.log('Checking satisfiability of requirement "%s"', reqName);

  async.every(requirement, function (req, callback) {
    switch (req.type) {
      case 'which':
        console.log('Checking requirement type "which"');

        exec(which + ' ' + req.input, function (err, stdo, stde) {
          callback(!err);
        });
        break;
      case 'cmd':
        console.log('Checking requirement type "cmd"');

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

  server.on('connect', function () {
    console.log('Connected to server %s to build %s', serverUrl, data.repoUrl);

    git.pullOrClone(data.repoUrl, function (err, repoPath) {
      if (err) {
        server.emit('message', 'Error cloning or updating repo %s\n%s', data.repoUrl, err);
      }
      builder.startBuild(data, repoPath, server, function () {
        server.disconnect();
      });
    });
  });

  server.on('connect_failed', function () {
    console.error("Couldn't connect to server %s", serverUrl);
    registry.emit('markFree');
  });

  server.on('disconnect', function () {
    console.log('Disconnected from server %s', serverUrl);
    registry.emit('markFree');
  });

  server.on('error', function (err) {
    console.error('Error when communicating with server %s about %s\n%s',
        serverUrl, data.repoUrl, err);
    registry.emit('markFree');
  });
}

function start() {
  console.log('Connecting to registry at %s...', config.registry);
  var registry = io_client.connect(config.registry, { 'log level': 1 });

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
          console.log('Checking requirements "%s"', audreyConfig.requirements);

          for (var reqName in audreyConfig.requirements) {
            checkRequirement(registry, reqName, audreyConfig.requirements[reqName], repoUrl);
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

    registry.emit('markBusy');

    async.detect(data.serverUrls, function (serverUrl, callback) {
      var parsed = url.parse(serverUrl),
          port = parsed.port,
          hostname = parsed.hostname;

      console.log('Trying to reach %s on port %d', hostname, port);

      var client = net.createConnection(port, hostname, function () {
        console.log('Successfully reached %s on port %d', hostname, port);
        callback(true);
      });

      client.on('error', function () {
        callback(false);
      });
      client.on('timeout', function () {
        callback(false);
      });
    }, function (serverUrl) {
      if (serverUrl) {
        runBuild(serverUrl, data, registry);
      } else {
        registry.emit('markFree');
        console.error('Server was not reachable at any of the urls tried');
      }
    });
  });
}

module.exports = start;