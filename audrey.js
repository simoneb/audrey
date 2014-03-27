var cli = require('commander'),
    _ = require('lodash');

var defaultRegistry = "http://audrey.herokuapp.com";

function run(options) {
  require('./app/' + options._name)(options);
}

cli.command('server')
    .description('Starts a server')
    .option("-r, --registry <url>", "The url of the registry", defaultRegistry)
    .option("-p, --port <port>", "Port on which to listen for agent connections", parseInt, 3031)
    .action(run);

cli.command('agent')
    .description('Starts an agent')
    .option("-r, --registry <url>", "The url of the registry", defaultRegistry)
    .action(run);

cli.command('registry')
    .description('Starts a registry')
    .option("-p, --port <port>", "Port on which to listen for server and agent connections",
      parseInt, process.env.PORT || 5000)
    .action(run);

cli.parse(process.argv);

if (!cli.args.length) cli.help();