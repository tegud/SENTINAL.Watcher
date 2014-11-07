
var getConfiguredModulesForFiles = function(type, callback) {
	console.log('Would be getting ' + type + ' configs from ElasticSearch');
	callback(null, []);
}; 

module.exports = {
	getConfiguredModules: getConfiguredModulesForFiles
};
