var config = require('../../config');
var sources = config.getConfiguredModulesForType('sources');

module.exports = {
	registerSource: function(name, source) {
		sources[name] = source;
	},
	clear: function() {
		sources = {};
	},
	getSource: function(name) {
		return sources[name];
	}
};
