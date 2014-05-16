var elasticsearch = require('elasticsearch');
var moment = require('moment');

var buildQuery = require('./queryBuilder');

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
		search: function(search) {
			var query = {
				index: search.index,
				body: buildQuery(search.options)
			};
			return client.search(query);
		}
	};
};
