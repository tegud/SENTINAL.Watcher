var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var alerts = require('./lib/alerts');
var config = require('./lib/config');


var dir = __dirname + '/config';

config.getConfiguredAlerts(dir, function(err, configuredAlerts) {
	console.log(configuredAlerts);

	var setNextPing = setTimeout.bind(null, ping, 25000);
	
	var ping = function() {
		console.log('Checking alerts...');

		async.parallel(alertCheckTasks, function() {
			console.log('alert checks complete');
			setNextPing();
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
