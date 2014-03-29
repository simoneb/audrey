function AudreyModel(){
  var self = this;
  this.repositories = ko.observableArray();
  this.selectedRepository = ko.observable({ agents: {}});
  this.repositoryAgents = ko.computed(function(){
    return Object.keys(self.selectedRepository().agents)
        .map(function(agentId){
          return agentId + ': ' + self.selectedRepository().agents[agentId];
        });
  });

  this.addRepositories = function(repos) {
    var urlRegex = /(\w+):\/\/(.+)\/(\w+)\/(.+)/;

    Object.keys(repos).forEach(function(repo) {
      if(self.repositories.indexOf(repo) == -1) {
        var repoData = urlRegex.exec(repo);

        self.repositories.push({
          url: repo,
          shortName: repoData[3] + '/' + repoData[4],
          agents: repos[repo]
        });
      }
    });

    self.selectedRepository(self.repositories()[0]);
  };
}

$(function () {
  var audreyModel = new AudreyModel();
  ko.applyBindings(audreyModel, document.body);

  var socket = io.connect('http:///client');

  socket.on('connect', function () {
    console.log('connected');
  });
  socket.on('message', function (message) {
    console.log(message);
  });
  socket.on('repositories', function(repos) {
    audreyModel.addRepositories(repos);
  });
  /*socket.on('agentRegistration', function(agentId, registration) {
    audreyModel.addRegistration(agentId, registration);
  });*/
});