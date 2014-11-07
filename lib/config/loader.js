var async = require('async');
var _ = require('lodash');
var loadFromFile = require('./loadFromFile');
var loadFromElasticSearch = require('./loadFromElasticSearch');

var mapConfigResponseToHashmap = function(configuredAlerts, callback) {
	callback(null, _.reduce(configuredAlerts, function(memo, alert) {
		if(!memo[alert.name]) {
			memo[alert.name] = [];
		}
		memo[alert.name].push(alert.config);

		return memo;
	}, {}));
};

var getConfigedModulesFromAllSources = function(rootDir, moduleType, callback) {
	async.parallel([
		async.apply(loadFromFile.getConfiguredModules, rootDir + '/' + moduleType),
		async.apply(loadFromElasticSearch.getConfiguredModules, moduleType)
	], function (err, result) { callback(err, _.flatten(result)); } );
}

var getConfiguredModules = function(rootDir, moduleType, callback) {
	async.waterfall([
		async.apply(getConfigedModulesFromAllSources, rootDir, moduleType),
		mapConfigResponseToHashmap
	], callback);
}; 

module.exports = {
	loadConfigurationForModules: function(rootDir, moduleTypes, callback) {
		var tasks = _.map(moduleTypes, function(moduleType) {
			return async.apply(async.waterfall, [
					async.apply(getConfiguredModules, rootDir, moduleType),
					function(config, callback) {
						callback(null, {
							name: moduleType,
							config: config
						});
					}
				]);
		});

		async.parallel(tasks, callback);
	}
};
