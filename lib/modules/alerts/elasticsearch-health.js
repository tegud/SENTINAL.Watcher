var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var Promise = require('bluebird');
var http = require('http');

var Recorder = require('../../recorder');
var events = require('../../events');
var notifiers = require('../../modules/notifiers');
var sources = require('../../modules/sources');
var schedulers = require('../../modules/schedulers');
var logstash = require('../../utilities/logstash');

var moduleName = 'elasticsearch-health';

function loadMapper (mapperConfig) {
	return require('../sources/elasticsearch/mappers/' + mapperConfig.type)(mapperConfig);
}

function loadThreshold (recorder, thresholdConfig) {
	return new require('../thresholds/' + thresholdConfig.type)(recorder, thresholdConfig);
}

module.exports = function() {
	var eventName;
	var query;
	var recorder;
	var scheduler;
	var notifierConfig;
	var name;
	var source;
	var mappers = [];
	var thresholds = [];
	var eventBuilders = [];
	var baseEventInfo = {};
	var servers;
	var checks;
	var maxAllowedTimeout;

	function checkThresholdsAndEmitEvent(result) {
		var now = moment();
		var thresholdResults = _.map(thresholds, function(threshold){
			return threshold.checkValue();
		});

		var breaches = _.filter(thresholdResults, function(threshold) {
			return threshold.breached;
		});

		var eventInfo = _.extend({
			matchedThreshold: _.first(breaches),
			thresholds: thresholdResults
		}, baseEventInfo, result);

		var eventLevel = eventInfo.matchedThreshold ? eventInfo.matchedThreshold.level : 'info';

		async.reduce(eventBuilders, {
			raised: now.utc().toDate(),
			level: eventLevel,
			info: eventInfo
		}, function(memo, builder, callback) {
			builder(memo, callback);
		}, function(err, event) {
			events.emit(eventName, event);

			scheduler.scheduleNext();
		});
	}

	var responseMappers = {
		state: function(data) {
			var masterNodeId = data.master_node;
			var knownNodes = _.chain(data.nodes).map(function(node) {
				return node.name;
			}).sortBy(function() {
				
			}).value();

			return {
				master: data.nodes[masterNodeId].name,
				nodes: knownNodes
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

	function serverCheck(server, resolve) {
		var checksPromises = _.map(checks, function(check, key) {
			return performServerCheck(server, check, key);
		});

		return Promise.all(checksPromises).then(function(results) {
			if(resolve) {
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

				resolve({
					server: name,
					results: results
				});
			}
		});
	}
	
	var lastStatuses = {};
	var lastKnownMaster;

	function check() {
		var serversPromises = _.map(servers, function(server) {
			return new Promise(function(resolve, reject) {
				return serverCheck(server, resolve);
			});
		});

		Promise
			.all(serversPromises)
			.then(function(results) {
				var serverState = _.map(results, function(server) {
					var errors = _.filter(server.results, function(result) { return result.error || !result.result; });
					var status = 'OK';

					if(errors.length) {
						if(_.every(errors, function(error) { return error.error.indexOf('Timeout') === 0; })) {
							status = 'TIMEOUT';
						}
						else {
							status = 'FAILED';
						}
					}

					if(status !== 'TIMEOUT') {
						lastStatuses[server.server] = {
							timestamp: moment(),
							status: status,
							errors: errors
						};
					}

					return {
						name: server.server,
						status: status,
						results: server.results,
						errors: errors
					};
				});
				var clusterState;
				var master;
				var shardData = {};

				if(_.every(serverState, function(server) {
					return server.status === 'FAILED';
				})) {
					clusterState = 'red';
				}
				else {
					var healthResponse = _.chain(serverState).map(function(server) {
						var healthCheckResult = _.chain(server.results).filter(function(result) {
							return result.check === 'health' && result.result;
						}).first().value();

						if(!healthCheckResult) {
							return;
						}

						return healthCheckResult.result;
					}).first().value();

					var stateResponse = _.chain(serverState).map(function(server) {
						var stateCheckResult = _.chain(server.results).filter(function(result) {
							return result.check === 'state' && result.result;
						}).first().value();

						if(!stateCheckResult) {
							return;
						}

						return stateCheckResult.result;
					}).first().value();

					clusterState = healthResponse ? healthResponse.status : 'UNKNOWN';
					master = stateResponse ? stateResponse.master : 'UNKNOWN';

					if(healthResponse) {
						shardData = {
							activePrimary: healthResponse.active_primary_shards,
							activeTotal: healthResponse.active_shards,
							relocating: healthResponse.relocating_shards,
							initializing: healthResponse.initializing_shards,
							unassigned: healthResponse.unassigned_shards
						};
					}
				}

				if(master === 'UNKNOWN' && lastKnownMaster) {
					master = lastKnownMaster;
				}
				else if(master !== 'UNKNOWN') {
					lastKnownMaster = master;
				}

				var currentClusterState = {
					state: clusterState,
					shards: shardData,
					nodes: _.map(serverState, function(node) {
						var result = {
							name: node.name,
							status: node.status,
							isMaster: node.name === master
						};

						if(node.errors.length) {
							result.errors = node.errors;
						}

						if(node.status === 'TIMEOUT') {
							var lastKnownStatus = lastStatuses[node.name];

							if(lastKnownStatus) {
								result.lastKnownStatus = lastKnownStatus;
								result.lastKnownStatus.timeSince = moment().diff(moment(lastKnownStatus.timestamp), 'ms');

								if(maxAllowedTimeout && result.lastKnownStatus.timeSince > maxAllowedTimeout) {
									result.status = 'LONG-TIMEOUT';
									result.lastKnownStatus.threshold = maxAllowedTimeout;
								}
							}
							else {
								result.lastKnownStatus = 'UNKNOWN';
								
								result.status = 'LONG-TIMEOUT';
							}
						}

						return result;
					})
				};

				if(_.any(currentClusterState.nodes, function(node) { return node.status === 'FAILED' || node.status === 'LONG-TIMEOUT'; })) {
					currentClusterState.state = 'red';
				}

				recorder.record(currentClusterState);

				checkThresholdsAndEmitEvent(currentClusterState);
			});
	}

	return {
		configure: function(config, callback) {
			servers = [
				'pentlrges05',
				'pentlrges06',
				'pentlrges07',
				'pentlrges08',
				'pentlrges09',
				'pentlrges10',
				'pentlrges11',
				{ name: '*', host: '127.0.0.1', port: 5000 }
			];

			checks = {
				state: '/_cluster/state/master_node,nodes',
				health: '/_cluster/health'//,
				//lag: '/{todays_index}/_search',
			};

			eventName = moduleName + '.' + config.name;

			name = config.name;

			recorder = new Recorder({ maxRecordings: 3 });
			scheduler = schedulers.createFromConfig(config.schedule, check);
			notifierConfig = config.notifications;
			source = sources.getSource(config.source);
			maxAllowedTimeout = config.maxAllowedTimeout || 0;

			mappers = _.map(config.mappers, loadMapper);
			thresholds = _.map(config.thresholds, async.apply(loadThreshold, recorder));

			notifiers.registerAlertNotifications(eventName, notifierConfig);

			eventBuilders = _.map(config.eventBuilders, function(config) {
				return new require('../eventBuilders/' + config.type)(config);
			});

			baseEventInfo = {
				site: config.site
			};

			callback();
		},
		initialise: function(callback) {
			scheduler.start();

			callback();
		}
	};
};