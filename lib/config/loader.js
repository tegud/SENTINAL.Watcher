var async = require('async');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var getConfigurationFiles = function(dir, done) {
	async.waterfall([
	    async.apply(fs.readdir, dir),
	    function(files, callback) {
	        async.filter(files, function(file, callback) {
	            fs.stat(dir + '/' + file, function(err, fileInfo) {
	                callback(!err && !fileInfo.isDirectory());
	            });
	        }, async.apply(callback, undefined));
	    }
	], done);
};

var stripExtension = function(filename) {
	if(!filename) {
		return filename;
	}

	var lastDotIndex = filename.lastIndexOf('.');

	if(lastDotIndex < 0) {
		return filename;
	}

	return filename.substring(0, lastDotIndex);
};

var loadConfigFromFiles = function(dir, files, callback) {
	async.map(files, async.apply(loadConfigFile, dir), callback)
};

var loadConfigFile = function(dir, file, callback) {
	fs.readFile(path.join(dir, '/', file), 'utf-8', function(err, data) {
		callback(err, { name: stripExtension(file), config: JSON.parse(data) });
	});
};

var mapConfigResponseToHashmap = function(configuredAlerts, callback) {
	callback(null, _.reduce(configuredAlerts, function(memo, alert) {
		memo[alert.name] = alert.config;
		return memo;
	}, {}));
};

var getConfiguredModules = function(dir, callback) {
	async.waterfall([
		async.apply(getConfigurationFiles, dir),
		async.apply(loadConfigFromFiles, dir),
		mapConfigResponseToHashmap
	], callback);
}; 

module.exports = {
	loadConfigurationForModules: function(rootDir, moduleTypes, callback) {
		var tasks = _.map(moduleTypes, function(moduleType) {
			return async.apply(async.waterfall, [
					async.apply(getConfiguredModules, rootDir + '/' + moduleType),
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
