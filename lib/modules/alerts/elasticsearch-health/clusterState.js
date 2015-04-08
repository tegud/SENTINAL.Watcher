var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
var objectUtils = require('../../../utilities/object');

function getFirstAvailableResponseByType(servers, checkType) {
	return _.chain(servers).map(function(server) {
		var result = _.chain(server.results).filter(function(result) {
			return result.check === checkType && result.result;
		}).first().value();

		if(!result) {
			return;
		}

		return result.result;
	}).first().value();
}

function map(collection, propertyMappings) {
	var output = {};

	_.each(propertyMappings, function(from, to) {
		var value = objectUtils.getValueFromSubProperty(collection, from);

		objectUtils.setDeepProperty(output, to, value);
	});

	return output;
}

module.exports = function(servers, config) {
	var lastKnownMaster;
	var serverStateByName  = _.reduce(servers, function(state, server) {
		state[server] = {
			name: server,
			status: 'UNKNOWN',
			isMaster: false
		};

		return state;
	}, {});

	var serverStatsByName = _.reduce(servers, function(state, server) {
		state[server] = { name: server };

		return state;
	}, {});

	var serverIdLookup = {};

	var shardState = {};

	return {
		getCurrentState: function() {
			var clusterState;
			var master;
			var shardData = {};
			var todaysIndex = {};
			var todaysLogstashIndex = 'logstash-' + moment().format('YYYY.MM.DD');

			if(_.every(serverStateByName, function(server) {
				return server.status === 'FAILED';
			})) {
				clusterState = 'red';
			}
			else {
				var healthResponse = getFirstAvailableResponseByType(serverStateByName, 'health');
				var stateResponse = getFirstAvailableResponseByType(serverStateByName, 'state');

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

				if(stateResponse) {
					if(stateResponse.routing_nodes && stateResponse.routing_nodes.unassigned && stateResponse.routing_nodes.unassigned.length) {
						shardData.unassigned = stateResponse.routing_nodes.unassigned.length;
						shardData.unassignedShards = _.map(stateResponse.routing_nodes.unassigned, function(shard) {
							return {
								primary: shard.primary,
								shard: shard.shard,
								index: shard.index
							};
						});
					}

					if(stateResponse.routing_table && stateResponse.routing_table.indices && stateResponse.routing_table.indices[todaysLogstashIndex]) {
						todaysIndex = _.chain(stateResponse.routing_table.indices[todaysLogstashIndex].shards)
							.reduce(function(shard, allShards) {
								allShards = allShards.concat(shard);

								return allShards;
							}, [])
							.map(function(shard) {
								if(shard.node) {
									var nodeFromState = _.chain(stateResponse.nodes).filter(function(stateNode) {
										return shard.node === stateNode.id;
									}).first().value();

									if(nodeFromState) {
										shard.nodeName = nodeFromState.name;
									}
									else {
										shard.nodeName = 'NONE';
									}
								}
								else {
									shard.node = 'NONE';
									shard.nodeName = 'NONE';
								}

								return shard;
							})
							.groupBy('nodeName')
							.map(function(node, name) {
								return {
									name: name,
									shards: node
								}
							})
							.sortBy(function(node) {
								return node.name === 'NONE' ? 'ZZZZZ-NONE' : node.name
							})
							.value(); 
					}
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
				todaysIndex: todaysIndex,
				nodes: _.map(serverStateByName, function(node) {
					var result = {
						name: node.name,
						status: node.status,
						isMaster: node.name === master
					};

					if(stateResponse) {
						var nodeFromState = _.chain(stateResponse.nodes).filter(function(stateNode) {
							return node.name === stateNode.name;
						}).first().value();

						if(nodeFromState) {
							serverStatsByName[node.name] = _.extend({}, serverStatsByName[node.name], {
								id: nodeFromState.id,
								ip: nodeFromState.ip,
								tags: nodeFromState.tags
							});

							serverIdLookup[nodeFromState.id] = node.name;
						}
					}
					
					return _.extend({}, result, serverStatsByName[node.name]);
				})
			};

			if(_.any(currentClusterState.nodes, function(node) { return node.status === 'FAILED' || node.status === 'LONG-TIMEOUT'; })) {
				currentClusterState.state = 'red';
			}

			return currentClusterState;
		},
		setNodeStatus: function(allNodeStatuses) {
			_.each(allNodeStatuses, function(stats, id) {
				var nodeName = serverIdLookup[id];

				if(!nodeName) {
					return;
				}

				serverStatsByName[nodeName].stats = map(stats, {
					'memory.gc.pools': 'jvm.mem.pools',
					'memory.gc.pools.young.time': 'jvm.gc.collectors.young',
					'memory.gc.pools.survivor.time': 'jvm.gc.collectors.survivor',
					'memory.gc.pools.old.time': 'jvm.gc.collectors.old',
					'memory.heap.used.bytes': 'jvm.mem.heap_used_in_bytes',
					'memory.heap.used.percent': 'jvm.mem.heap_used_percent',
					'memory.heap.max': 'jvm.mem.heap_max_in_bytes',
					'memory.heap.committed.bytes': 'jvm.mem.heap_committed_in_bytes',
					'cpu.process': 'process.cpu.percent',
					'cpu.os': 'os.cpu',
					'network.tcp': 'network.tcp',
					'http': 'http',
					'fs': 'fs',
					'breakers': 'breakers'
				});
			});
		},
		setServerState: function(serverState) {
			return new Promise(function (resolve, reject) {
				if(serverState.status === 'TIMEOUT') {
					var lastKnownStatus = serverStateByName[serverState.name].lastKnownStatus || { status: 'UNKNOWN' };

					if(lastKnownStatus.status === 'UNKNOWN') {
						serverState.status = 'LONG-TIMEOUT';
					}
					else {
						lastKnownStatus = lastKnownStatus;
						lastKnownStatus.timeSince = moment().diff(moment(lastKnownStatus.timestamp), 'ms');

						if(config.maxAllowedTimeout && lastKnownStatus.timeSince > config.maxAllowedTimeout) {
							serverState.status = 'LONG-TIMEOUT';
							lastKnownStatus.threshold = config.maxAllowedTimeout;
						}
					}

					serverState.lastKnownStatus = lastKnownStatus;
				}
				else {
					serverState.lastKnownStatus = {
						timestamp: moment(),
						status: serverState.status,
						errors: serverState.errors
					};
				}

				serverStateByName[serverState.name] = serverState;

				resolve(servers);
			});
		}
	};
};
