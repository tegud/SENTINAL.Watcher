var http = require('http');
var Promise = require('bluebird');
var _ = require('lodash');

var transportIpRegex = /inet\[\/([^:]+):[0-9]+\]/i;
var defaultTimeout = 2500;

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

module.exports = function performServerCheck(server, check, checkName, timeoutOverride) {
	var isTimeout;

	return new Promise(function(resolve, reject) {
		var host;
		var port;
		var timeout = !timeoutOverride || isNaN(timeoutOverride) ? defaultTimeout : timeoutOverride;

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
				var data;

				try {
					data = JSON.parse(allData.join(''));
				}
				catch(e) {
					return resolve({
						check: checkName,
						error: 'INVALID JSON'
					});
				}

				if(res.statusCode === 500) {
					console.log('Error with check: ' + checkName);
					console.log(data.error);
					return resolve({
						check: checkName,
						error: 'ES 500: ' + data.error
					});
				}

				console.log('Check response: ' + checkName);

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
