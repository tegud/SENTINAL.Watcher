var async = require('async');
var fs = require('fs');
var path = require('path');

var getConfigurationFiles = function(dir, callback) {
	async.waterfall([
	    async.apply(fs.readdir, dir),
	    function(files, callback) {
	        async.filter(files, function(file, callback) {
	            fs.stat(dir + '/' + file, function(err, fileInfo) {
	                callback(!err && !fileInfo.isDirectory());
	            });
	        }, async.apply(callback, undefined));
	    }
	], function(err, result) {
		callback(null, result || []);
	});
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
		var config = JSON.parse(data);
		config.name = stripExtension(file);

		callback(err, { name: config.type || config.name, config: config });
	});
};

var getConfiguredModulesForFiles = function(dir, callback) {
	async.waterfall([
		async.apply(getConfigurationFiles, dir),
		async.apply(loadConfigFromFiles, dir)
	], callback);
}; 

module.exports = {
	getConfiguredModules: getConfiguredModulesForFiles
};
