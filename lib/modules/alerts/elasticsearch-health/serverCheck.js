var performServerCheck = require('./checkRequest');

var Promise = require('bluebird');
var _ = require('lodash');

function getServerName(server) {
	var name;
	if(typeof server === 'string') {
		name = server;
	}
	else if(server.name) {
		name = server.name;
	}
	else {
		name = server.host + ':' + (server.port || 9200)
	}

	return name;
}

function allServerChecksComplete(server, results) {
	return new Promise(function(resolve, reject) {
		var errors = _.filter(results, function(result) { return result.error || !result.result; });

		var status = 'OK';
		if(errors.length) {
			if(_.every(errors, function(error) { return error.error.indexOf('Timeout') === 0; })) {
				status = 'TIMEOUT';
			}
			else {
				status = 'FAILED';
			}
		}

		resolve({
			name: getServerName(server),
			status: status,
			results: results,
			errors: errors
		});
	});
}

function serverCheck(clusterState, checks, server, resolve) {
	return Promise.all(_.map(checks, performServerCheck.bind(undefined, server)))
		.then(allServerChecksComplete.bind(undefined, server))
		.then(clusterState.setServerState)
		.then(resolve);
};

module.exports = serverCheck;
