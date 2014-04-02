var Status = {
  unknown: 'Unknown',
  created: 'Created',
  running: 'Running',
  inconclusive: 'Inconclusive',
  error: 'Error',
  completed: 'Completed'
};

function BuildCellModel(cell, cellIndex) {
  this.env = cell.env;
  this.requirements = cell.requirements;
  this.cellIndex = cellIndex;
  this.log = ko.observableArray();
  this.status = ko.observable(Status.created);

  this.started = function (data) {
    this.status(Status.running);
    this.log.push('Build started with data ' + JSON.stringify(data));
  };

  this.completed = function () {
    this.status(Status.completed);
  };

  this.message = function(message) {
    this.log.push(message);
  };

  this.buildLog = function (message) {
    this.log.push(message);
  };

  this.error = function (err) {
    this.status(Status.error);
    this.log.push(err.toString());
  };

  this.agentFound = function() {
    this.log.push('Available agent found');
  };

  this.agentNotFound = function() {
    this.status(Status.inconclusive);
    this.log.push('Available agent not found');
  };
}

function BuildModel() {
  var self = this;

  this.buildId = uuid();
  this.cells = ko.observableArray();
  this.ownStatus = ko.observable(Status.created);
  this.status = ko.computed(function () {
    if (this.cells().length) {
      var uniqueStatuses = _.uniq(_.invoke(this.cells(), 'status'));

      if (uniqueStatuses.length === 1) {
        return uniqueStatuses[0];
      } else {
        if (_.contains(uniqueStatuses, Status.error)) {
          return Status.error;
        }
        if (_.contains(uniqueStatuses, Status.running)) {
          return Status.running;
        }

        return uniqueStatuses[0];
      }
    } else {
      return this.ownStatus();
    }
  }, this);
  this.log = ko.observableArray();

  function getCell(cellIndex) {
    return _.find(self.cells(), { cellIndex: cellIndex });
  }

  this.matrix = function (cell, index) {
    this.cells.push(new BuildCellModel(cell, index));
  };

  this.cellStarted = function (data, cellIndex) {
    getCell(cellIndex).started(data);
  };

  this.cellMessage = function(message, cellIndex) {
    getCell(cellIndex).message(message);
  };

  this.cellBuildLog = function (message, cellIndex) {
    getCell(cellIndex).buildLog(message);
  };

  this.error = function (err) {
    this.ownStatus(Status.error);
    this.log.push(JSON.stringify(err));
  };

  this.message = function (message) {
    this.log.push(message);
  };

  this.cellCompleted = function (cellIndex) {
    getCell(cellIndex).completed();
  };

  this.cellError = function (err, cellIndex) {
    getCell(cellIndex).error(err);
  };

  this.cellAgentFound = function(cellIndex) {
    getCell(cellIndex).agentFound();
  };

  this.cellAgentNotFound = function(cellIndex) {
    getCell(cellIndex).agentNotFound();
  };
}

function RepositoryModel(repoUrl) {
  var self = this,
      urlRegex = /(\w+):\/\/(.+)\/(\w+)\/(.+)/,
      repoData = urlRegex.exec(repoUrl);

  this.repoUrl = repoUrl;
  this.shortName = repoData[3] + '/' + repoData[4];
  this.builds = ko.observableArray();

  this.lastBuild = ko.computed(function () {
    return this.builds().length && this.builds()[this.builds().length - 1];
  }, this);

  this.status = ko.computed(function () {
    return this.lastBuild() && this.lastBuild().status() || Status.unknown;
  }, this);

  this.displayRunButton = ko.computed(function () {
    return this.status() !== Status.running;
  }, this);

  this.displayStopButton = ko.computed(function () {
    return this.status() === Status.running;
  }, this);

  this.runBuild = function () {
    self.builds.push(new BuildModel());
    server.emit('runBuild', repoUrl, this.lastBuild().buildId);
  };

  this.stopBuild = function (buildId) {
    server.emit('stopBuild', buildId);
  };

  this.cellStarted = function (data, cellIndex) {
    this.lastBuild().cellStarted(data, cellIndex);
  };

  this.cellError = function (err, cellIndex) {
    this.lastBuild().cellError(err, cellIndex);
  };

  this.cellBuildLog = function (message, cellIndex) {
    this.lastBuild().cellBuildLog(message, cellIndex);
  };

  this.buildError = function (err, buildId) {
    this.lastBuild().error(err);
  };

  this.buildMessage = function (message) {
    this.lastBuild().message(message);
  };

  this.cellCompleted = function (cellIndex) {
    this.lastBuild().cellCompleted(cellIndex);
  };

  this.cellMessage = function (message, cellIndex) {
    this.lastBuild().cellMessage(message, cellIndex);
  };

  this.buildMatrix = function (cell, index) {
    this.lastBuild().matrix(cell, index);
  };

  this.cellAgentFound = function(cellIndex) {
    this.lastBuild().cellAgentFound(cellIndex);
  };

  this.cellAgentNotFound = function(cellIndex) {
    this.lastBuild().cellAgentNotFound(cellIndex);
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

  function getRepoByBuild(buildId) {
    if (!buildsToRepo[buildId]) {
      buildsToRepo[buildId] = _.find(self.repositories(), function (repo) {
        return repo.lastBuild().buildId === buildId;
      });
    }

    return buildsToRepo[buildId];
  }

  self.cellStarted = function (data, buildId, cellIndex) {
    getRepoByBuild(buildId).cellStarted(data, cellIndex);
  };

  self.cellCompleted = function (buildId, cellIndex) {
    getRepoByBuild(buildId).cellCompleted(cellIndex);
  };

  self.cellBuildLog = function (message, buildId, cellIndex) {
    getRepoByBuild(buildId).cellBuildLog(message, cellIndex);
  };

  self.buildError = function (err, buildId) {
    getRepoByBuild(buildId).buildError(err);
  };

  self.cellError = function (err, buildId, cellIndex) {
    getRepoByBuild(buildId).cellError(err, cellIndex);
  };

  self.buildMatrix = function (cell, index, buildId) {
    getRepoByBuild(buildId).buildMatrix(cell, index);
  };

  self.buildMessage = function (message, buildId) {
    getRepoByBuild(buildId).buildMessage(message);
  };

  self.cellMessage = function (message, buildId, cellIndex) {
    getRepoByBuild(buildId).cellMessage(message, cellIndex);
  };

  self.cellAgentFound = function(buildId, cellIndex) {
    getRepoByBuild(buildId).cellAgentFound(cellIndex);
  };

  self.cellAgentNotFound = function(buildId, cellIndex) {
    getRepoByBuild(buildId).cellAgentNotFound(cellIndex);
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
  server.on('cellAgentFound', function(buildId, cellIndex) {
    model.cellAgentFound(buildId, cellIndex);
  });
  server.on('cellAgentNotFound', function(buildId, cellIndex) {
    model.cellAgentNotFound(buildId, cellIndex);
  });
  server.on('cellStarted', function (data, buildId, cellIndex) {
    model.cellStarted(data, buildId, cellIndex);
  });
  server.on('buildError', function (err, buildId) {
    model.buildError(err, buildId);
  });
  server.on('cellError', function (err, buildId, cellIndex) {
    model.cellError(err, buildId, cellIndex);
  });
  server.on('cellCompleted', function (buildId, cellIndex) {
    model.cellCompleted(buildId, cellIndex);
  });
  server.on('cellBuildLog', function (message, buildId, cellIndex) {
    model.cellBuildLog(message, buildId, cellIndex);
  });
  server.on('buildMessage', function (message, buildId) {
    model.buildMessage(message, buildId);
  });
  server.on('cellMessage', function (message, buildId, cellIndex) {
    model.cellMessage(message, buildId, cellIndex);
  });
  server.on('buildMatrix', function (cell, index, buildId) {
    model.buildMatrix(cell, index, buildId);
  });
  server.on('repos', function (repos) {
    model.addRepositories(repos);
  });
});