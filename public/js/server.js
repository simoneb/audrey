$(function () {
  /*var audreyModel = new AudreyModel();
  ko.applyBindings(audreyModel, document.body);
*/
  var socket = io.connect('http:///client');

  socket.on('connect',function () {
    console.log('connected');
  }).on('message',function (message) {
        console.log(message);
      }).on('repos',function (repos) {
        audreyModel.addRepositories(repos);
      }).on('agentRegistration',function (agentId, registration) {
        audreyModel.addRegistration(agentId, registration);
      }).on('agentDisconnected',function (agentId) {
        audreyModel.removeAgent(agentId);
      }).on('agentBusy',function (agentId) {
        audreyModel.agentBusy(agentId);
      }).on('agentFree', function (agentId) {
        audreyModel.agentFree(agentId);
      });
});