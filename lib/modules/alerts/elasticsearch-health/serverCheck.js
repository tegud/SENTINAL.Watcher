var http = require('http');

var Promise = require('bluebird');
var _ = require('lodash');

var transportIpRegex = /inet\[\/([^:]+):[0-9]+\]/i;

function extractIpFromTransportAddress(transportAdress) {
	var matches = transportIpRegex.exec(transportAdress);

	if(!matches) {
		return transportAdress;
	}

	return matches[1];
}

var responseMappers = {
	state: function(data) {
		var masterNodeId = data.master_node;
		var knownNodes = _.map(data.nodes, function(node, id) {
			return { 
				name: node.name, 
				id: id,
				ip: extractIpFromTransportAddress(node.transport_address),
				tags: node.attributes ? node.attributes.tag : ''
			};
		});

		return {
			master: data.nodes[masterNodeId].name,
			nodes: knownNodes,
			routing_table: data.routing_table,
			routing_nodes: data.routing_nodes
		};
	}
}

function performServerCheck(server, check, checkName) {
	var isTimeout;

	return new Promise(function(resolve, reject) {
		var host;
		var port;

		if(typeof server === 'string') {
			host = server;
			port = 9200;
		}
		else {
			host = server.host;
			port = server.port;
		}

		var req = http.request({
			hostname: host,
			port: port,
			path: check,
			method: 'GET'
		}, function(res) {

			var allData = [];
			res.on('data', function(data) {
				allData.push(data);
			});

			res.on('end', function() {
				var data = JSON.parse(allData.join(''));

				if(res.statusCode === 500) {
					return resolve({
						check: checkName,
						error: 'ES 500: ' + data.error
					});
				}

				resolve({
					check: checkName,
					result: responseMappers[checkName] ? responseMappers[checkName](data) : data
				});
			});
		});

		req.on('error', function(e) {
			resolve({
				check: checkName,
				error: e.message
			});
		});

		req.on('socket', function (socket) {
			var timeout = 2500;
			socket.setTimeout(timeout);
			socket.on('timeout', function() {
				resolve({
					check: checkName,
					error: 'Timeout after ' + timeout + 'ms'
				});
				req.abort();
			});
		});

		req.end();
	});
}

function getServerName(server) {
	var name;
	if(typeof server === 'string') {
		name = server;
	}
	else if(server.name) {
		name = server.name;
	}
	else {
		name = server.host + ':' + server.port 
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
