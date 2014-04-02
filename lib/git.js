var fs = require('fs'),
    exec = require('child_process').exec,
    path = require('path'),
    url = require('url'),
    sys = require('sys');

function puts(error, stdout, stderr) {
  //if(error) throw error;

  if(stdout) sys.puts(stdout)
  if(stderr) sys.puts(stderr);
}

function pullOrClone(repoUrl, callback) {
  // TODO: this needs to be adjusted to work with non-github repos
  var repoPath = path.join(process.cwd(), '.audrey', 'repos',
    url.parse(repoUrl).pathname.substring(1));

  function execCb(err, stdout, stderr) {
    callback(err, stdout, stderr, repoPath);
  }

  if(fs.existsSync(repoPath)) {
    exec("git pull -f --all", { cwd: repoPath }, execCb);
  } else {
    // TODO: npm install makedirp
    var parts = '';
    repoPath.split(path.sep).forEach(function(p) {
      parts += p + path.sep;
      if(!fs.existsSync(parts)){
        fs.mkdirSync(parts);
      }
    });

    exec("git clone " + repoUrl + " " + repoPath, execCb);
  }
}

function lastCommitShortHash(callback) {
  exec('git log --oneline -1', function(err, out) {
    if (err) callback(err);

    try {
      callback(undefined, /^\w+/.exec(out.toString())[0]);
    } catch(e) {
      callback(e);
    }
  });
}

exports.pullOrClone = pullOrClone;
exports.lastCommitShortHash = lastCommitShortHash;