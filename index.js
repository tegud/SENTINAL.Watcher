var async = require('async');
var _ = require('lodash');
var alerts = require('./lib/alerts');
var config = require('./lib/config');

var dir = __dirname + '/config';

config.getConfiguredAlerts(dir, function(err, configuredAlerts) {
	var ping = function() {
		console.log('Checking alerts...');

		async.parallel(alertCheckTasks, function() {
			console.log('alert checks complete');
			setTimeout(ping, 5000);
		});
	};

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

	async.parallel(alertConfigTasks, ping);
});
