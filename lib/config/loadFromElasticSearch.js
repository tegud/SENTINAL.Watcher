var async = require('async');
var fs = require('fs');
var path = require('path');
var elasticsearch = require('elasticsearch');

var loadConfigFile = function(dir, file, callback) {
	fs.readFile(path.join(dir, '/', file), 'utf-8', function(err, data) {
		var config = JSON.parse(data);

		callback(err, config);
	});
};

var loadConfigFromElasticSearch = function(type, config, callback) {
	var client = new elasticsearch.Client({
		host: config.host
	});

	config.query.index = config.query.index;
	config.query.type = type;

	client.search(config.query)
	.then(function(response) {
		var configs = response.hits.hits.map(function(item) { return item._source; });
		callback(null, configs);
	}, function(err) {
		callback(err);
	});
}

var getConfiguredModulesForFiles = function(rootDir, type, callback) {
	console.log('Getting ' + type + ' configs from ElasticSearch');

	if (!fs.existsSync(path.join(rootDir, '/', 'configSources.json'))) {
		console.log('Can`t get config from Elastic Search - configSources.json missing.')
		return callback(null, []);
	}

	async.waterfall([
		async.apply(loadConfigFile, rootDir, 'configSources.json'),
		async.apply(loadConfigFromElasticSearch, type)
		], callback);
}; 

module.exports = {
	getConfiguredModules: getConfiguredModulesForFiles
};
