function RepositoryModel(repoUrl) {
  var urlRegex = /(\w+):\/\/(.+)\/(\w+)\/(.+)/,
      repoData = urlRegex.exec(repoUrl);

  this.repoUrl = repoUrl;
  this.shortName = repoData[3] + '/' + repoData[4];
  this.buildLog = ko.observableArray();
  this.status = ko.observable();
  this.displayRunButton = ko.computed(function () {
    return this.status() !== 'running'
  }, this);
  this.displayStopButton = ko.computed(function () {
    return this.status() === 'running'
  }, this);

  this.runBuild = function() {
    socket.emit('runBuild', repoUrl);
  };

  this.stopBuild = function() {
    socket.emit('stopBuild', repoUrl);
  };

  this.buildStarted = function (data, buildId) {
    this.status('running');
    this.buildLog.push('Build started with data ' + JSON.stringify(data));
  };

  this.build = function (message, buildId) {
    this.buildLog.push(message);
  };

  this.buildError = function (err, buildId) {
    this.status('error');
    this.buildLog.push(err.toString());
  };

  this.buildCompleted = function (buildId) {
    this.status('completed');
  };

  this.message = function(message) {
    this.buildLog.push(message);
  }
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

  self.buildStarted = function (data, buildId) {
    var repo = _.find(self.repositories(), { repoUrl: data.repoUrl });
    buildsToRepo[buildId] = repo;

    repo.buildStarted(data, buildId);
  };

  self.build = function (message, buildId) {
    buildsToRepo[buildId].build(message, buildId);
  };

  self.buildError = function (err, buildId) {
    buildsToRepo[buildId].buildError(err, buildId);
  };

  self.message = function(message, repoUrl) {
    _.find(self.repositories(), { repoUrl: repoUrl }).message(message);
  };
}

var socket;

$(function () {
  var serverModel = new ServerModel();
  ko.applyBindings(serverModel, document.body);

  socket = io.connect('http:///client');

  socket.on('connect', function () {
    console.log('connected');
  });
  socket.on('agentConnected', function (agentId, buildId) {
    console.log('agent connected');
  });
  socket.on('buildStarted', function (data, buildId) {
    console.log('build started');
    serverModel.buildStarted(data, buildId);
  });
  socket.on('buildError', function (err, buildId) {
    serverModel.buildError(err, buildId);
  });
  socket.on('buildCompleted', function (buildId) {
    console.log('buildCompleted');
  });
  socket.on('build', function (message, buildId) {
    serverModel.build(message, buildId);
  });
  socket.on('message', function (message, repoUrl) {
    serverModel.message(message, repoUrl);
    console.log(message);
  });
  socket.on('agentDisconnected', function (agentId, buildId) {
    console.log('agent disconnected');
  });
  socket.on('repos', function (repos) {
    serverModel.addRepositories(repos);
  });
});