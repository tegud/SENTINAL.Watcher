const moment = require('moment');
const http = require('http');
const https = require('https');
const async = require('async');
const _ = require('lodash');
const url = require('url');
const fs = require('fs');

function checkServerHealth(server, healthChecker, certificate, callback) {
	let isTimeout;
	const proxy = _.merge(healthChecker.proxyOverride, server.proxyOverride);
	let options;
	const port = server.port || (healthChecker.secure === true ? 443 : 80);
	const fullCheckUrl = url.format({
		protocol: (healthChecker.secure === true ? 'https' : 'http'),
		pathname: healthChecker.path,
		hostname: server.host,
		port: port
	});

	if (proxy) {
		options = {
			host: proxy.host,
			port: proxy.port || 80,
			method: 'GET',
			path: fullCheckUrl,
			rejectUnauthorized: false,
			headers: _.merge({}, healthChecker.headers, server.headers)
		};
	} else {
		options = {
			host: server.host,
			port: port,
			method: 'GET',
			path: healthChecker.path,
			rejectUnauthorized: false,
			headers: _.merge({}, healthChecker.headers, server.headers)
		};
	}

	if(certificate) {
		options.ca = certificate;
	}

	if(healthChecker.authentication) {
		var auth = 'Basic ' + new Buffer(healthChecker.authentication.username + ':' + healthChecker.authentication.password).toString('base64');

		options.headers.Authorization = auth;
	}

	const req = (healthChecker.secure === true ? https : http).request(options, res => {
		let allBody = '';

		res.on('data', chunk => allBody += chunk);

		res.on('end', () => {
			let matchedStatus;
			const numberOfHealthCheckers = healthChecker.status.length;
			let x = 0;
			let matchDetails;

			for(;x < numberOfHealthCheckers;x++) {
				let matched = true;
				matchDetails = {};

				if(healthChecker.status[x].statusRegex) {
					let statusRegex = new RegExp(healthChecker.status[x].statusRegex);
					matched = statusRegex.test(res.statusCode);
					matchDetails.status = true;
				}

				if (healthChecker.status[x].contentRegex) {
					let contentRegex = new RegExp(healthChecker.status[x].contentRegex);
					matched = contentRegex.test(allBody);
					matchDetails.content = true;
				}

				if(matched) {
					matchedStatus = healthChecker.status[x];
					break;
				}
			}

			if (!matchedStatus) {
				matchedStatus = {name:"Unknown"};
			}

			callback(null, {
				server: server,
				url: fullCheckUrl,
				status: {
					status: matchedStatus.name,
					statusCode: res.statusCode,
					matched: matchDetails
				}
			});
		});
	});

	if(healthChecker.timeout) {
		req.on('socket', socket => {
			socket.setTimeout(healthChecker.timeout.timeout);
			socket.on('timeout', () => {
				isTimeout = true;
				req.abort();
			});
		});
	}

	req.on('error', err => {
		callback(null, {
			server: server,
			fullUrl: fullCheckUrl,
			status: {
				status: isTimeout ? healthChecker.timeout.status : 'ERROR',
				err: err
			}
		});
	});

	req.end();
}

module.exports = () => {
	let config;
	let certificates;

	return {
		configure: (sourceConfig, callback) => {
			config = sourceConfig;
			callback();
		},
		initialise: callback => {
			certificates = _.reduce(config.healthCheckers, (certs, checker, name) => {
				if(checker.certificatePath) {
				    try {
				        certs[name] = fs.readFileSync(checker.certificatePath);
				    }
				    catch(ex) {
				        console.log(`Failed to load certificate for ${name}: ${ex}`);
				    }
				}

				return certs;
			}, {});

			callback();
		},
		getServerHealth: callback => {
			let checkTasks = [];

			_.each(config.groups, (group, groupName) => {
				_.each(group, (subGroup, subGroupName) => {
					_.each(subGroup, (server, index) => {
						let serverWithPathInfo = _.extend({groupName : groupName, subGroupName:subGroupName}, server);
						checkTasks.push(async.apply(checkServerHealth, serverWithPathInfo, config.healthCheckers[server.healthCheck], certificates[server.healthCheck]));
					});
				});
			});

			async.parallel(checkTasks, (err, responses) => {
				callback(err, _.reduce(responses, (memo, serverResponse) => {
					const group = serverResponse.server.groupName;
					if (memo[group] == undefined) {
						memo[group] = {};
					}
					const subGroup = serverResponse.server.subGroupName;
					if (memo[group][subGroup] == undefined) {
						memo[group][subGroup] = {};
					}
					const name = serverResponse.server.name;

					memo[group][subGroup][name] = serverResponse;

					return memo;
				}, {}));
			});
		}
	};
};
