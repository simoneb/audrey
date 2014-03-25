var fs = require('fs'),
    exec = require('child_process').exec,
    path = require('path'),
    sys = require('sys');

function puts(error, stdout, stderr) {
  if(error) throw error;

  if(stdout) sys.puts(stdout)
  if(stderr) sys.puts(stderr);
}

function pullOrClone(repoUrl, repoPath, callback) {
  function doCallback(err, stdout, stderr) {
    puts(err, stdout, stderr);

    if(!err) callback();
  }

  if(fs.existsSync(repoPath)) {
    console.log('Updating repo at %s', repoPath);
    exec("git pull --all", { cwd: repoPath }, doCallback);
  } else {
    var parts = '';
    repoPath.split(path.sep).forEach(function(p) {
      parts += p + path.sep;
      if(!fs.existsSync(parts)){
        fs.mkdirSync(parts);
      }
    });

    console.log('Cloning %s into %s', repoUrl, repoPath);
    exec("git clone " + repoUrl, { cwd: repoPath }, doCallback);
  }
}

exports.pullOrClone = pullOrClone;