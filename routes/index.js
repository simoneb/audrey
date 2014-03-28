var git = require('../lib/git');

exports.index = function (req, res) {
  git.lastCommitShortHash(function (err, hash) {
    res.render('index', {
      title: 'audrey',
      revision: err ? "can't determine revision" : hash
    });
  });
};