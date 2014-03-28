var isWindows = process.platform === 'win32',
    path = require('path'),
    fs = require('fs');

exports.isWindows = isWindows;
exports.which = isWindows ? 'where' : 'which';
exports.getAudreyConfig = function(repoPath, callback) {
  try {
    callback(undefined, require(path.join(repoPath, '.audrey.js')));
  } catch(e) {
    callback(e, undefined);
  }
};
exports.registryUrl = function(url, namespace) {
    return url + (url[url.length-1] === '/' ? '' : '/') + namespace;
};