var async = require('async');
var _ = require('lodash');
var alerts = require('./lib/alerts');
var configLoader = require('./lib/config/loader');

var dir = __dirname + '/config';

async.waterfall([
		async.apply(configLoader.loadConfigurationForModules, dir, ['alerts', 'notifiers', 'sources']),
		function(results, callback) {
			var configuredAlerts = results[0];
			var configuredNofifiers = results[1];
			var configuredSources = results[2];

			var alertsInConfig = _.reduce(alerts, function(memo, alert, alertName) {
				if(_.contains(Object.keys(configuredAlerts), alertName)) {
					memo[alertName] = alert;
				}
				return memo;
			}, {});

			var alertConfigTasks = _.map(alertsInConfig, function(alert, alertName) {
				return async.apply(alert.configure, configuredAlerts[alertName]);
			});

			var alertCheckTasks = _.pluck(alertsInConfig, 'check');

			console.log('Configuring ' + alertConfigTasks.length + ' alert(s)...');

			async.parallel(alertConfigTasks, function(err) {
				callback(err, alertCheckTasks);
			});
		}
	], function(err, alertCheckTasks) {
		var ping = function() {
			console.log('Checking alerts...');

			async.parallel(alertCheckTasks, function() {
				console.log('alert checks complete');
				setTimeout(ping, 5000);
			});
		};

		ping();
});
