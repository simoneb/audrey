var os = require('os'),
    _ = require('lodash'),
    net = require('net'),
    url = require('url'),
    async = require('async'),
    debug = require('debug')('audrey:net');

function getLocalAddresses(inclInternal) {
  return _.chain(os.networkInterfaces())
      .values()
      .flatten()
      .filter(function (e) {
        return e.family === 'IPv4' && (inclInternal || !e.internal);
      })
      .map(_.property('address'))
      .value();
}

function firstReachableUrl(urls, callback) {
  async.detect(urls, function (theurl, cb) {
    var parsed = url.parse(theurl),
        port = parsed.port,
        hostname = parsed.hostname;

    debug('Trying to reach %s on port %d', hostname, port);

    var client = net.connect(port, hostname, function () {
      debug('Successfully reached %s on port %d', hostname, port);
      client.end();
      cb(true);
    });

    client.on('error', function () {
      cb(false);
    });

    client.on('timeout', function () {
      cb(false);
    });
  }, callback);
}

exports.getLocalAddresses = getLocalAddresses;
exports.firstReachableUrl = firstReachableUrl;