var cli = require('commander'),
    _ = require('lodash');

var registryUrl = "http://audrey.herokuapp.com",
    config = require('./audrey.json');

function run(config) {
  return function (options) {
    require('./app/' + options._name)(_.merge(config || {}, options));
  };
}

cli.command('server')
    .description('Starts a server')
    .option("-r, --registry <url>", "The url of the registry", registryUrl)
    .option("-a, --address <address>", "IP address/hostname on which to listen for agent connections")
    .option("-p, --port <port>", "Port on which to listen for agent connections",
    parseInt, 5001)
    .action(run(config.server));

cli.command('agent')
    .description('Starts an agent')
    .option("-r, --registry <url>", "The url of the registry", registryUrl)
    .action(run(config.agent));

cli.command('registry')
    .description('Starts a registry')
    .option("-p, --port <port>", "Port on which to listen for server and agent connections",
    parseInt, process.env.PORT || 5000)
    .action(run(config.registry));

cli.parse(process.argv);

if (!cli.args.length) cli.help();