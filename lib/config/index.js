var async = require('async');
var _ = require('lodash');

var configLoader = require('./loader');

var moduleTypes = [
	'notifiers', 
	'alerts', 
	'sources'
];

var configuredModules = (function() {
	var types = { };

	return {
		register: function(type, module, instanceName) {
			if(!types[type]) {
				types[type] = {};
			}

			if(!types[type][module]) {
				types[type][module] = [];
			}

			var instance = new require('../modules/' + type + '/' + module)();

			console.log('Registered ' + type + ' module: ' + module + ', ' + instanceName);

			types[type][module].push(instance);

			return instance;
		},
		getModuleTypesAndTheirModules: function(type) {
			return _.map(moduleTypes, function(type) {
				return { name: type, modules: types[type] || {} }
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
						var configTasks = _.reduce(moduleType.config, function(memo, config, module) {
							var concattedTasks = Array.prototype.concat(memo, _.map(config, function(instance) {
								var moduleInstance = configuredModules.register(moduleType.name, module, instance.name);

								return async.apply(moduleInstance.configure || function(config, callback) { 
									console.log('')
									callback(); 
								}, instance);
							}));

							return concattedTasks;
						}, []);

						async.parallel(configTasks, callback);
					}, callback);
				}
			], callback);
	},
	getConfiguredModulesForAllTypes: configuredModules.getModuleTypesAndTheirModules,
	getConfiguredModulesForType: function(moduleType, type) {
		return _.filter(configuredModules.getModuleTypesAndTheirModules(), function(currentModuleType) {
			return moduleType === currentModuleType.name;
		})[0].modules[type];
	}
};
