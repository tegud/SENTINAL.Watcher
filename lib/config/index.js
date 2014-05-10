var async = require('async');
var _ = require('lodash');

var configLoader = require('./loader');

var moduleTypes = [
	'alerts', 
	'notifiers', 
	'sources'
];

module.exports = {
	configureModules: function(dir, callback) {
		async.waterfall([
				async.apply(configLoader.loadConfigurationForModules, dir, moduleTypes),
				function(results, callback) {
					async.each(results, function(moduleType, callback) {
						var alertConfigTasks = _.map(moduleType.config, function(config, alertName) {
							return async.apply(require('../' + moduleType.name + '/' + alertName).configure, config);
						});

						console.log('Configuring ' + moduleType.name + ', ' + alertConfigTasks.length + ' item(s) to configure...');

						async.parallel(alertConfigTasks, function(err) {
							callback(err, results);
						});
					}, function(err) {
						callback(err, results);
					});
				}
			], callback);
	}
};
