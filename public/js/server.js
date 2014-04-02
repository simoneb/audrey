function RepositoryModel(repoUrl) {
  var urlRegex = /(\w+):\/\/(.+)\/(\w+)\/(.+)/,
      repoData = urlRegex.exec(repoUrl);

  this.repoUrl = repoUrl;
  this.shortName = repoData[3] + '/' + repoData[4];
  this.buildLog = ko.observableArray();

  this.buildStarted = function(data, buildId) {
    this.buildLog.push('Build started with data ' + JSON.stringify(data));
  };

  this.build = function(message, buildId) {
    this.buildLog.push(message);
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

  self.buildStarted = function(data, buildId) {
    var repo = _.find(self.repositories(), { repoUrl: data.repoUrl });
    buildsToRepo[buildId] = repo;

    repo.buildStarted(data, buildId);
  }

  self.build = function(message, buildId) {
    buildsToRepo[buildId].build(message, buildId);
  };
}

$(function () {
  var serverModel = new ServerModel();
  ko.applyBindings(serverModel, document.body);

  var socket = io.connect('http:///client');

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
    console.log('build error')
  });
  socket.on('buildCompleted', function (buildId) {
    console.log('buildCompleted');
  });
  socket.on('build', function (message, buildId) {
    serverModel.build(message, buildId);
  });
  socket.on('message', function (message, buildId) {
    console.log(message);
  });
  socket.on('agentDisconnected', function(agentId, buildId) {
    console.log('agent disconnected');
  });
  socket.on('repos', function (repos) {
    serverModel.addRepositories(repos);
  });
});