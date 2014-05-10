var async = require('async');
var _ = require('lodash');
var config = require('./lib/config');

async.waterfall([
		async.apply(config.configureModules, __dirname + '/config'), 
		function (results, callback) {
			var alertCheckTasks = _.map(results[0].config, function(alert, alertName) {
				return require('./lib/' + results[0].name + '/' + alertName).check;
			});

			callback(null, alertCheckTasks);
		}
	], 
	function(err, alertCheckTasks) {
		var ping = function() {
			console.log('Checking alerts...');

			async.parallel(alertCheckTasks, function() {
				console.log('alert checks complete');
				setTimeout(ping, 5000);
			});
		};

		ping();
});
