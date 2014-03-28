var cli = require('commander'),
    _ = require('lodash'),
    path = require('path'),
    registryUrl = "http://audrey.herokuapp.com",
    defaultServerPort = 5001,
    defaultRegistryPort = 5000,
    config = loadConfig();

function loadConfig() {
  try {
    return require(path.join(process.cwd(), 'audrey.json'));
  } catch (e) {
    return {};
  }
}

function list(str) {
  return str.split(',');
}

function run(config) {
  return function (options) {
    require('./app/' + options._name)(_.merge(config || {}, options));
  };
}

cli.command('server')
    .description('Starts a server')
    .option("-r, --registry <url>", "The url of the registry", registryUrl)
    .option("-a, --address <address>",
        "IP address or hostname on which to listen for agent connections. By default it is inferred from the local NICs")
    .option("-p, --port <port>", "Port on which to listen for agent connections",
        parseInt, defaultServerPort)
    .option("-R, --repositories <urls>", "A comma separated list of urls of the repositories to build", list, [])
    .action(run(config.server));

cli.command('agent')
    .description('Starts an agent')
    .option("-r, --registry <url>", "The url of the registry", registryUrl)
    .option("-R, --repositories <urls>", "A comma separated list of urls of the repositories to build", list, [])
    .action(run(config.agent));

cli.command('registry')
    .description('Starts a registry')
    .option("-p, --port <port>", "Port on which to listen for server and agent connections",
        parseInt, process.env.PORT || defaultRegistryPort)
    .action(run(config.registry));

cli.parse(process.argv);

if (!cli.args.length) cli.help();