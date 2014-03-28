var fs = require('fs'),
    exec = require('child_process').exec,
    path = require('path'),
    url = require('url'),
    sys = require('sys');

function puts(error, stdout, stderr) {
  if(error) throw error;

  if(stdout) sys.puts(stdout)
  if(stderr) sys.puts(stderr);
}

function pullOrClone(repoUrl, callback) {
  var repoPath = path.join(process.cwd(), '.audrey', 'repos',
    url.parse(repoUrl).pathname.substring(1));

  function doCallback(err, stdout, stderr) {
    puts(err, stdout, stderr);
    callback(err, repoPath);
  }

  if(fs.existsSync(repoPath)) {
    console.log('Updating repo at %s', repoPath);
    exec("git pull --all", { cwd: repoPath }, doCallback);
  } else {
    // TODO: npm install makedirp
    var parts = '';
    repoPath.split(path.sep).forEach(function(p) {
      parts += p + path.sep;
      if(!fs.existsSync(parts)){
        fs.mkdirSync(parts);
      }
    });

    console.log('Cloning %s into %s', repoUrl, repoPath);
    exec("git clone " + repoUrl + " " + repoPath, doCallback);
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