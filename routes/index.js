var git = require('../lib/git');

exports.registry = function (req, res) {
  git.lastCommitShortHash(function (err, hash) {
    res.render('registry', {
      title: 'audrey registry',
      revision: err ? "can't determine revision" : hash,
      script: 'registry.js'
    });
  });
};

exports.server = function(req, res) {
  res.render('server', {
    title: 'audrey server',
    script: 'server.js'
  });
};