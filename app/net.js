var os = require('os'),
    lodash = require('lodash');

function getLocalAddresses() {
  return lodash.chain(os.networkInterfaces())
      .values()
      .flatten()
      .filter(function(e) { return e.family === 'IPv4'; })
      .map(lodash.property('address'))
      .value();
}

exports.getLocalAddresses = getLocalAddresses;