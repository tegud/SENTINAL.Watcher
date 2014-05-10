var async = require('async');
var config = require('./lib/config');
var modules = require('./lib/modules');

async.series([
		async.apply(config.configureModules, __dirname + '/config'), 
		modules.initialiseAll
	], 
	function(err) {
		console.log('Start up of SENTINAL.Watcher completed.');
	});
