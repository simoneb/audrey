var git = require('../lib/git');

exports.registry = function (req, res) {
  git.lastCommitShortHash(function (err, hash) {
    res.render('registry', {
      title: 'audrey',
      revision: err ? "can't determine revision" : hash,
      script: 'registry.js'
    });
  });
};