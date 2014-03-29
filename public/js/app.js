function AgentModel(agentId, agentData) {
  this.id = agentId;
  this.requirements = agentData.requirements;
  this.busy = ko.observable(agentData.busy);
}

function RepositoryModel(repoUrl, agentMap) {
  var self = this,
      urlRegex = /(\w+):\/\/(.+)\/(\w+)\/(.+)/,
      repoData = urlRegex.exec(repoUrl);

  this.repoUrl = repoUrl;
  this.shortName = repoData[3] + '/' + repoData[4];
  this.agents = ko.observableArray(
      Object.keys(agentMap).map(function (agentId) {
        return new AgentModel(agentId, agentMap[agentId]);
      }));

  this.addRegistration = function (agentId, reg) {
    self.agents.push(new AgentModel(agentId, { requirements: reg.requirements }));
  };

  this.removeAgent = function (agentId) {
    self.agents.remove(function(agent) {
      return agent.id === agentId;
    });
  };

  this.agentBusy = function(agentId) {
    _.find(self.agents(), { id: agentId }).busy(true);
  };

  this.agentFree = function(agentId) {
    _.find(self.agents(), { id: agentId }).busy(false);
  };
}

function AudreyModel() {
  var self = this;
  this.repositories = ko.observableArray();
  this.selectedRepository = ko.observable();

  this.addRepositories = function (repos) {
    _.forIn(repos, function (agents, repoUrl) {
      self.repositories.push(new RepositoryModel(repoUrl, agents));
    });

    self.selectedRepository(self.repositories()[0]);
  };

  this.addRegistration = function (agentId, reg) {
    var repo = _.find(self.repositories(), { repoUrl: reg.repoUrl });

    if (repo) {
      repo.addRegistration(agentId, reg);
    } else {
      var agentMap = {};
      agentMap[agentId] = { requirements: reg.requirements };
      self.repositories.push(new RepositoryModel(reg.repoUrl, agentMap))
    }
  };

  this.removeAgent = function (agentId) {
    self.repositories().forEach(function (repo) {
      repo.removeAgent(agentId);
    });
  };

  this.agentBusy = function(agentId) {
    self.repositories().forEach(function (repo) {
      repo.agentBusy(agentId);
    });
  };

  this.agentFree= function(agentId) {
    self.repositories().forEach(function (repo) {
      repo.agentFree(agentId);
    });
  };
}

$(function () {
  var audreyModel = new AudreyModel();
  ko.applyBindings(audreyModel, document.body);

  var socket = io.connect('http:///client');

  socket.on('connect', function () {
    console.log('connected');
  }).on('message', function (message) {
    console.log(message);
  }).on('repos', function (repos) {
    audreyModel.addRepositories(repos);
  }).on('agentRegistration', function (agentId, registration) {
    audreyModel.addRegistration(agentId, registration);
  }).on('agentDisconnected', function (agentId) {
    audreyModel.removeAgent(agentId);
  }).on('agentBusy', function (agentId) {
    audreyModel.agentBusy(agentId);
  }).on('agentFree', function (agentId) {
    audreyModel.agentFree(agentId);
  });
});