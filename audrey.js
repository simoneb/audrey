var argv = process.argv.slice(2);

require('./app/' + argv.shift())[argv.shift()](argv);

