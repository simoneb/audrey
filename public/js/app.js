var socket = io.connect('http:///client');

socket.on('connect', function(){
  console.log('connected');
});
socket.on('message', function(message) {
  console.log(message);
});