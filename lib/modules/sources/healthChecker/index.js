var moment = require('moment');
var http = require('http');
var async = require('async');
var _ = require('lodash');

function checkServerHealth(server, healthChecker, callback) {
	var isTimeout;
	var req = http.request({
		host: server.host,
		port: server.port || 80,
		method: 'GET',
		path: healthChecker.path
	}, function(res) {
		res.on('data', function() {});

		res.on('end', function() {
			var matchedStatus;
			var numberOfHealthCheckers = healthChecker.status.length;
			var x = 0;

			for(;x < numberOfHealthCheckers;x++) {
				var statusRegex = new RegExp(healthChecker.status[x].statusRegex);

				if(statusRegex.test(res.statusCode)) {
					matchedStatus = healthChecker.status[x];
					break;
				}
			}

			console.log(res.statusCode);

			callback(null, {
				server: server,
				status: {
					status: matchedStatus.name
				}
			});
		});
	});

	if(healthChecker.timeout) {
		req.on('socket', function (socket) {
	        socket.setTimeout(healthChecker.timeout.timeout);
	        socket.on('timeout', function() {
	        	isTimeout = true;
	            req.abort();
	        });
		});
	}

    req.on('error', function(err) {
        callback(null, {
			server: server,
			status: {
				status: isTimeout ? healthChecker.timeout.status : 'ERROR'
			}
		});
    });

    req.end();
}

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
			var checkTasks = config.servers.map(function(server) {
				return async.apply(checkServerHealth, server, config.healthCheckers[server.healthCheck]);
			});

			async.parallel(checkTasks, function(err, responses) {
				console.log(responses);
				callback(err, _.reduce(responses, function(memo, serverResponse) {
					memo[serverResponse.server.name] = serverResponse;

					return memo;
				}, {}));
			});
		}
	};
};
