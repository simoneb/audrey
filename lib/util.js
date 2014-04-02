var isWindows = process.platform === 'win32',
    path = require('path'),
    fs = require('fs')
crypto = require('crypto');

exports.isWindows = isWindows;
exports.which = isWindows ? 'where' : 'which';
exports.getAudreyConfig = function (repoPath, callback) {
  try {
    callback(undefined, require(path.join(repoPath, '.audrey.js')));
  } catch (err) {
    callback(err, undefined);
  }
};
exports.registryUrl = function (url, namespace) {
  return url + (url[url.length - 1] === '/' ? '' : '/') + namespace;
};
exports.randomString = function (byteLength) {
  return crypto.randomBytes(byteLength).readUInt32LE(0) + '';
};
exports.merge = function (target, source) {
  for (var key in source) {
    if (!target.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }

  return target;
};