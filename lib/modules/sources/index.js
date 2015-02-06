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
		if (sources[name] == undefined) {
			throw "Unknown source: " + name;
		}

		return sources[name];
	}
};
