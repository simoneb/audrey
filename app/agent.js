var io_client = require('socket.io-client'),
    git = require('./git'),
    os = require('os'),
    net = require('./net'),
    exec = require('child_process').exec,
    builder = require('./builder'),
    path = require('path'),
    async = require('async'),
    u = require('./util');

function handleRequirementOutput(result, output, callback) {
  switch (Object.prototype.toString.call(output)) {
    case '[object RegExp]':
      var success = output.test(result);

      if (!success)
        console.warn('%s did not match %s', result, output);

      callback(success);
      break;
    case '[object String]':
      var success = output === result;

      if (!success)
        console.warn('%s is not equal to %s', result, output);

      callback(success);
      break;
    default:
      console.error('Unrecognized requirement output type "%s"', output);
      callback(false);
  }
}

function checkRequirement(registry, reqName, requirement, repoUrl, outercb) {
  console.log('Checking satisfiability of requirement "%s"', reqName);

  async.rejectSeries(requirement, function (req, callback) {
    switch (req.type) {
      case 'which':
        var cmd = u.which + ' ' + req.input;
        exec(cmd, function (err) {
          if (err) console.warn('    %s failed', cmd);
          callback(!err);
        });
        break;
      case 'cmd':
        exec(req.input, function (err, stdo) {
          if (err) {
            console.warn('%s failed', req.input);
            callback(false);
          } else {
            handleRequirementOutput(stdo.toString(), req.output, callback);
          }
        });
        break;
      case 'js':
        var result = eval(req.input);

        handleRequirementOutput(result, req.output, callback);
        break;
      default:
        console.error('Unrecognized requirement type "%s"', req.type);
        callback(false);
    }
  }, function (unmatched) {
    if (unmatched.length) {
      console.log('Requirement "%s" not satisfied', reqName);
    } else {
      console.log('Requirement "%s" satisfied', reqName);
      registry.emit('register', { repoUrl: repoUrl, requirement: reqName });
    }

    outercb();
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

function agent(options) {
  if (!options.repositories.length) {
    console.error('There are no repositories to build');
    process.exit(0);
  }

  var registryUrl = u.registryUrl(options.registry, 'agent'),
      registry = io_client.connect(registryUrl, { 'log level': 1 });

  console.log('Connecting to registry %s...', registryUrl);

  registry.on('connect', function () {
    console.log('Connected to registry');

    options.repositories.forEach(function (repoUrl) {
      git.pullOrClone(repoUrl, function (err, repoPath) {
        if (err) throw err;

        u.getAudreyConfig(repoPath, function (err, config) {
          if (err) throw err;

          if (!config.requirements) {
            console.log('Registering without requirements');
            registry.emit('register', { repoUrl: repoUrl });
          } else {
            console.log('Checking all requirements');

            async.eachSeries(Object.keys(config.requirements), function (reqName, callback) {
              checkRequirement(registry, reqName, config.requirements[reqName], repoUrl, callback);
            }, function () {
              console.log('Ready to accept build requests');
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