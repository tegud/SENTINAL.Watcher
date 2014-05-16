var _ = require('lodash');
var async = require('async');
var config = require('../config');

module.exports = {
	initialiseAll: function(callback) {
		console.log('Initialising modules...');

		var allModuleTypes = config.getConfiguredModulesForAllTypes();
		var moduleTypeTasks = _.map(allModuleTypes, function(moduleType) {
			var moduleTasks = _.map(moduleType.modules, function(instance) {
				return instance.initialise || function(callback) {
					console.log('No initialise method for module (' + moduleType.name + ').');
					callback();
				};
			});

			console.log('Initialising ' + moduleType.name + ', ' + moduleTasks.length + ' item(s) to initialise.')

			return async.apply(async.parallel, moduleTasks);
		});

		async.series(moduleTypeTasks, callback);
	}
};
