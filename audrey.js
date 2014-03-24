var argv = process.argv.slice(2);

require('./' + argv.shift())[argv.shift()](argv);

