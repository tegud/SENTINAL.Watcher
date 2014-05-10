var async = require('async');
var _ = require('lodash');

var configLoader = require('./loader');

var moduleTypes = [
	'alerts', 
	'notifiers', 
	'sources'
];

var configuredModules = (function() {
	var types = { };

	return {
		register: function(type, module) {
			if(!types[type]) {
				types[type] = [];
			}

			types[type].push(module)
		},
		getModuleTypesAndTheirModules: function(type) {
			return _.map(moduleTypes, function(type) {
				return { name: type, modules: types[type] || [] }
			});
		}
	};
})();

module.exports = {
	configureModules: function(dir, callback) {
		console.log('Configuring modules...');

		async.waterfall([
				async.apply(configLoader.loadConfigurationForModules, dir, moduleTypes),
				function(results, callback) {
					async.each(results, function(moduleType, callback) {
						var configTasks = _.map(moduleType.config, function(config, module) {
							configuredModules.register(moduleType.name, module);

							return async.apply(require('../modules/' + moduleType.name + '/' + module).configure || function(config, callback) { 
								callback(); 
							}, config);
						});

						console.log('Configuring ' + moduleType.name + ', ' + configTasks.length + ' item(s) to configure...');

						async.parallel(configTasks, callback);
					}, callback);
				}
			], callback);
	},
	getConfiguredModulesForAllTypes: configuredModules.getModuleTypesAndTheirModules
};
