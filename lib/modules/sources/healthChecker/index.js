var moment = require('moment');

module.exports = function() {
	var config;

	return {
		configure: function(sourceConfig, callback) {
			config = sourceConfig;
			callback();
		},
		initialise: function(callback) {
			callback();
		},
		getServerHealth: function(callback) {
			callback();
		}
	};
};
