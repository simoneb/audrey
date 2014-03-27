var cli = require('commander'),
    _ = require('lodash');

var defaultRegistry = {
  registry: "http://audrey.herokuapp.com/server"
};

function run(defaults) {
  return function(options) {
    require('./app/' + options._name)(_.merge(defaults || {}, options));
  };
}

cli.command('server')
    .description('Starts a server')
    .option("-r, --registry <url>", "The url of the registry")
    .action(run(defaultRegistry));

cli.command('agent')
    .description('Starts an agent')
    .option("-r, --registry <url>", "The url of the registry")
    .action(run(defaultRegistry));

cli.command('registry')
    .description('Starts a registry')
    .action(run());

cli.parse(process.argv);

if(!cli.args.length) cli.help();