var elasticsearch = require('elasticsearch');

module.exports = function() {
	var client;
	var config;

	return {
		configure: function(sourceConfig, callback) {
			config = sourceConfig;
			callback();
		},
		initialise: function(callback) {
			client = new elasticsearch.Client({
				host: config.host
			});

			callback();
		},
		search: function(query) {
			return client.search(query);
		}
	};
};
