var debug = require('debug')('sentinel:alerts:kafka-check:index'),
    async = require('async'),
    events = require('../../../events'),
    notifiers = require('../../../modules/notifiers'),
    schedulers = require('../../../modules/schedulers'),
    topicChecker = require('./topicChecker'),
    tcpChecker = require('./tcpChecker'),
    zookeeper = require('node-zookeeper-client'),
    zkConsumers = require('./zk-consumers'),
    metrics = require('metrics'),
    _ = require('lodash'),
    kafka = require('kafka-node');

var moduleName = 'kafka-check';

module.exports = function () {
	var notifierConfig,
	    scheduler,
	    brokers,
	    zookeepers,
	    kafkaClient,
	    zookeeperClient,
	    zkConnect;
	var baseEventName;

	function check() {

		async.parallel([
			function (callback) {
				topicChecker(zkConnect, 'healthcheck', 3, function (result) {
					var eventInfo = {
						level: "info",
						metricName: "qa.kafka.healthcheck",
						code: result
					};

					events.emit(baseEventName + '.topic-check-per-broker', eventInfo);
					callback();
				});
			},
			function (callback) {
				topicChecker(zkConnect, 'replicated_healthcheck', 1, function (result) {
					var eventInfo = {
						level: "info",
						metricName: "qa.kafka.replicated_healthcheck",
						code: result
					};

					events.emit(baseEventName + '.topic-check', eventInfo);
					callback();
				});
			},	
			function (callback) {
				tcpChecker(brokers, function (err, result) {
					debug("tcpChecker", "kafka brokers", result);
					var eventInfo = {
						level: "info",
						metricName: "qa.kafka.brokers",
						status: result
					};
					events.emit(baseEventName + '.broker-status', eventInfo);
					callback();
				});
			},
			function (callback) {
				tcpChecker(zookeepers, function (err, result) {
					debug("tcpChecker", "zookeepers", result);
					var eventInfo = {
						level: "info",
						metricName: "qa.kafka.zookeepers",
						status: result
					};
					events.emit(baseEventName + '.zookeeper-status', eventInfo);
					callback();
				});
			}
		], function () {
			scheduler.scheduleNext();
		});
	};

	function kafka_monitor(callback) {
		var topicEventData = {
			topics: []
		};

		var brokerEventData = {
			brokers: []
		};

		var topicsWithNoLeaderData = {
			topicsWithNoLeader: []
		};

		var kafkaMonitor = new (require('./KafkaMonitor'))(zookeeperClient);

		kafkaMonitor.on('BROKER_ADDED', function (brokerId) {
			brokerEventData.brokers.push(brokerId);
			events.emit(baseEventName + '.brokers', brokerEventData);
		});

		kafkaMonitor.on('BROKER_REMOVED', function (brokerId) {
			_.remove(brokerEventData.brokers, function (v) {
				return v === brokerId;
			});
			events.emit(baseEventName + '.brokers', brokerEventData);
		});		

		kafkaMonitor.on('NEW_TOPIC', function (topic) {
			topicEventData.topics.push(topic);
			events.emit(baseEventName + '.topics', topicEventData);
		});

		kafkaMonitor.on('TOPIC_STATE_DATA_CHANGED', function (data) {
			debug("topic state change", data);

			events.emit(baseEventName + '.topicStates', data);

			//Update the leaders for the topics in the "topicEventData.topics" array
			var topicChanged = _.find(topicEventData.topics, { "topicName" : data.topicName });
			if(topicChanged) {
				var partitionChanged = _.find(topicChanged.partitions, { "partitionId" : data.topicPartitionId });
				if(partitionChanged) {
					partitionChanged.leader = data.topicStateData.leader;

					debug('Topic : ' + topicChanged.topicName + ' Partition : ' + partitionChanged.partitionId + ' Leader updated to : ' + partitionChanged.leader);
					events.emit(baseEventName + '.topics', topicEventData);
				}
			}

			//Check for topics in the 'topicsWithNoLeaderData.topicWithNoLeaders' array
			//and if the topic has a leader now remove it
			var topicToSearchFor = {
				'topicName': data.topicName, 
				'partitionId': data.topicPartitionId
			}

			var topicIndex = _.findIndex(topicsWithNoLeaderData.topicsWithNoLeader, topicToSearchFor);

			if(topicIndex > -1)
			{
				debug('topic leader restored : ' + JSON.stringify(topicToSearchFor));
				topicsWithNoLeaderData.topicsWithNoLeader.splice(topicIndex, 1);
			}
		});

		kafkaMonitor.on('TOPIC_HAS_NO_LEADER', function (topic) {
			debug("topic has no leader", topic);

			var topicLeaderData = {
				"topicName" : topic.topicName,
				"partitionId" : topic.topicPartitionId
			}

			topicsWithNoLeaderData.topicsWithNoLeader.push(topicLeaderData);
			events.emit(baseEventName + '.topicsWithNoLeaders', topicsWithNoLeaderData);
		});

		callback();
	};

	function zookeeper_monitor(callback) {
		var offset_event = [];

		var m = zkConsumers(zookeeperClient);
		m.on('consumer', function (_consumer) {
			debug('consumer', _consumer.getName());

			var consumer = {
				group: _consumer.getName(),
				topics: []
			};

			offset_event.push(consumer);

			_consumer.watch();
			_consumer.on('topic', function (_topic) {
				debug('topic', _topic.getName());

				var topicData = {
					name: _topic.getName(),
					partitions: []
				};
				consumer.topics.push(topicData);

				_topic.watch();
				_topic.on('offset', function (_offset) {
					debug(_consumer.getName(), _topic.getName(), 'offset for partition ' + _offset.partition + ' now ' + _offset.offset);

					if (!topicData.partitions[_offset.partition]) {
						topicData.partitions[_offset.partition] = {
							id: _offset.partition,
							meter: new metrics.Meter(),
							offset: _offset.offset,
							prev: _offset.offset
						};
					}

					var diff = _offset.offset - topicData.partitions[_offset.partition].prev;

					topicData.partitions[_offset.partition].meter.mark(diff);
					topicData.partitions[_offset.partition].prev = _offset.offset;

					topicData.partitions[_offset.partition].offset = topicData.partitions[_offset.partition].prev;
				});
				_topic.on('end', function () {
					// remove topic from consumer
					var c = _.find(offset_event, {group: _consumer.getName()});
					_.remove(c.topics, { name: _topic.getName()});

					delete topicData;
				});
			});

			_consumer.on('end', function () {
				debug('consumer ' + _consumer.getName() + ' gone away');
				_.remove(offset_event, function (v) {
					return v.group === _consumer.getName();
				});
			});
		});

 		var consumerIntervalFunc = setInterval(function () {
 			var offsets;

 			async.series([
 				function (callback) {
					var topics = {};
					_.forEach(offset_event, function (consumer) {
						_.forEach(consumer.topics, function (topic) {
							var parts = topic.partitions.length;
							if (topics[topic.name]) {
								if (topics[topic.name] < parts) topics[topic.name] = parts;
							} else {
								topics[topic.name] = parts;
							}
						});
					});

 					var kafkaOffsets = require('./kafka-offsets');
 					kafkaOffsets(zkConnect, topics, function (err, data) {
 						offsets = data;
 						debug('offsets', data);
 						callback(err);
 					});
 				},
 				function (callback) {
 					var eventData = [];
 					_.forEach(offset_event, function (consumer) {
 						var consumerData = {
 							group: consumer.group,
 							topics: []
 						};
 						eventData.push(consumerData);

 						_.forEach(consumer.topics, function (topic) {
 							var topicData = {
 								name: topic.name,
 								partitions: []
 							};
 							consumerData.topics.push(topicData);

 							_.forEach(topic.partitions, function (partition) {
 								topicData.partitions.push({
 									id: partition.id,
 									offset: partition.offset,
 									rates: partition.meter.rates(),
									lag: offsets[topic.name] ? offsets[topic.name][partition.id][0] - partition.offset : -1
 								});
 							});
 						});
 					});
 					events.emit(baseEventName + '.consumers', eventData);
 				}
 			]);
 		}, 5000);

		callback();
	};

	function init_kafka_client(callback) {
		async.map(zookeepers, function (item, callback) {
			callback(null, item.host + ':' + item.port);
		}, function (err, result) {
			zkConnect = result.join(',');
		});
		kafkaClient = new kafka.Client(zkConnect, 'sentinel');
		kafkaClient.on('ready', function () {
			zookeeperClient = kafkaClient.zk.client;
			callback();
		});
	};

	return {
		configure: function (config, callback) {
			debug("config", config);
			brokers = config.brokers;
			zookeepers = config.zookeepers;

			baseEventName = ["kafka-check", config.environment].join('.');

			scheduler = schedulers.createFromConfig(config.schedule, check);

			notifierConfig = config.notifications;
			notifiers.registerAlertNotifications(baseEventName + '.topic-check-per-broker', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.topic-check', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.broker-status', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.zookeeper-status', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.consumers', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.topics', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.brokers', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.topicsWithNoLeaders', notifierConfig);
			notifiers.registerAlertNotifications(baseEventName + '.topicStates', notifierConfig);

			async.series([
				function (callback) {
					init_kafka_client(callback);
				},
				function (callback) {
					zookeeper_monitor(callback);
				},
				function (callback) {
					kafka_monitor(callback);
				}
			]);

			callback();
		},
		initialise: function (callback) {
			scheduler.start();
			callback();
		}
	};
};

