function RepositoryModel(repoUrl) {
  var urlRegex = /(\w+):\/\/(.+)\/(\w+)\/(.+)/,
      repoData = urlRegex.exec(repoUrl);

  this.repoUrl = repoUrl;
  this.shortName = repoData[3] + '/' + repoData[4];
  this.buildLog = ko.observableArray();
  this.buildId = ko.observable();
  this.status = ko.observable();
  this.displayRunButton = ko.computed(function () {
    return this.status() !== 'running'
  }, this);
  this.displayStopButton = ko.computed(function () {
    return this.status() === 'running'
  }, this);

  this.runBuild = function () {
    this.buildId(uuid());
    this.buildLog([]);
    server.emit('runBuild', repoUrl, this.buildId());
  };

  this.stopBuild = function () {
    server.emit('stopBuild', this.buildId());
  };

  this.matrixStarted = function (data, matrixId) {
    this.status('running');
    this.buildLog.push('Build started with data ' + JSON.stringify(data));
  };

  this.matrixBuild = function (message, matrixId) {
    this.buildLog.push(message);
  };

  this.buildError = function (err, buildId) {
    this.status('error');
    this.buildLog.push(err.toString());
  };

  this.matrixCompleted = function (matrixId) {
    this.status('completed');
  };

  this.buildMessage = function (message, buildId) {
    this.buildLog.push(message);
  };

  this.matrixMessage = function(message, matrixid) {
    this.buildLog.push(message);
  }

  this.buildMatrix = function(cell, index, buildId) {

  };
}

function ServerModel() {
  var self = this,
      buildsToRepo = {};

  self.repositories = ko.observableArray();
  self.selectedRepository = ko.observable();

  self.addRepositories = function (repos) {
    repos.forEach(function (repo) {
      self.repositories.push(new RepositoryModel(repo));
    });

    self.selectedRepository(self.repositories()[0]);
  };

  self.agentConnected = function (agentId, buildId) {

  };
  self.agentDisconnected = function (agentId, buildId) {

  };

  function getRepoByBuild(id) {
    if(id.hasOwnProperty('id')) {
      id = id.id;
    };

    if(!buildsToRepo[id]) {
      buildsToRepo[id] = _.find(self.repositories(), function(repo) {
        return repo.buildId() === id;
      });
    }

    return buildsToRepo[id];
  }

  self.matrixStarted = function (data, matrixId) {
    getRepoByBuild(matrixId).matrixStarted(data, matrixId);
  };

  self.matrixCompleted = function(matrixId) {
    getRepoByBuild(matrixId).matrixCompleted(matrixId);
  };

  self.matrixBuild = function (message, matrixId) {
    getRepoByBuild(matrixId).matrixBuild(message, matrixId);
  };

  self.buildError = function (err, buildId) {
    getRepoByBuild(buildId).buildError(err, buildId);
  };

  self.matrixError = function (err, matrixId) {
    getRepoByBuild(matrixId).matrixError(err, matrixId);
  };

  self.buildMatrix = function (cell, index, buildId) {
    getRepoByBuild(buildId).buildMatrix(cell, index, buildId);
  };

  self.buildMessage = function (message, buildId) {
    getRepoByBuild(buildId).buildMessage(message);
  };

  self.matrixMessage = function(message, matrixId) {
    getRepoByBuild(matrixId).matrixMessage(message);
  };
}

var server;

$(function () {
  var model = new ServerModel();
  ko.applyBindings(model, document.body);

  server = io.connect('http:///client');

  server.on('connect', function () {
    console.log('connected');
  });
  server.on('agentConnected', function (agentId) {
    model.agentConnected(agentId);
  });
  server.on('agentDisconnected', function (agentId) {
    model.agentDisconnected(agentId);
  });
  server.on('matrixStarted', function (data, matrixId) {
    model.matrixStarted(data, matrixId);
  });
  server.on('buildError', function (err, buildId) {
    model.buildError(err, buildId);
  });
  server.on('matrixError', function (err, matrixId) {
    model.matrixError(err, matrixId);
  });
  server.on('matrixCompleted', function (matrixId) {
    model.matrixCompleted(matrixId);
  });
  server.on('matrixBuild', function (message, matrixId) {
    model.matrixBuild(message, matrixId);
  });
  server.on('buildMessage', function (message, buildId) {
    model.buildMessage(message, buildId);
  });
  server.on('matrixMessage', function(message, buildId){
    model.matrixMessage(message, buildId);
  });
  server.on('buildMatrix', function (cell, index, buildId) {
    model.buildMatrix(cell, index, buildId);
  });
  server.on('repos', function (repos) {
    model.addRepositories(repos);
  });
});