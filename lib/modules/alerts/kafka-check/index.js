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
	    zookeeperClient;
	var baseEventName;

	function check() {
		async.parallel([
			function (callback) {
				topicChecker(kafkaClient, 'healthcheck', 3, function (result) {
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
				topicChecker(kafkaClient, 'replicated_healthcheck', 1, function (result) {
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

		var kafkaMonitor = new (require('./KafkaMonitor'))(zookeeperClient);
		kafkaMonitor.on('NEW_TOPIC', function (topic) {
			topicEventData.topics.push(topic);
			events.emit(baseEventName + '.topics', topicEventData);
		});

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

		kafkaMonitor.on('TOPIC_HAS_NO_LEADER', function (topic) {
			debug("topic has no leader", topic);
		});

		kafkaMonitor.on('TOPIC_STATE_DATA_CHANGED', function (data) {
			debug("topic state change", data.toString('ascii'));
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

/*				setInterval(function () {
					partitions.forEach(function (o, p) {
						debug('partition ' + p + ' rate: ' + o.meter.meanRate());
						topicData = { current: o.prev, rate: o.meter.meanRate() };
					});
					events.emit(baseEventName + '.consumers', offset_event);
				}, 10000);
*/
				var partitionData = [];

				_topic.watch();
				_topic.on('offset', function (_offset) {
					debug(_consumer.getName(), _topic.getName(), 'offset for partition ' + _offset.partition + ' now ' + _offset.offset);

					if (!topicData.partitions[_offset.partition]) {
						topicData.partitions[_offset.partition] = {
							id: _offset.partition
						};
						partitionData[_offset.partition] = {
							meter: new metrics.Meter(),
							prev: _offset.offset
						};
					}

					var diff = _offset.offset - partitionData[_offset.partition].prev;

					partitionData[_offset.partition].meter.mark(diff);
					partitionData[_offset.partition].prev = _offset.offset;

					topicData.partitions[_offset.partition].offset = partitionData[_offset.partition].prev;
					topicData.partitions[_offset.partition].rates = partitionData[_offset.partition].meter.rates();

					events.emit(baseEventName + '.consumers', offset_event);
				});
				_topic.on('end', function () {
					// remove topic from consumer
					var c = _.find(offset_event, {group: _consumer.getName()});
					_.remove(c.topics, { name: _topic.getName()});

					delete topicData;
					delete partitionData;

					events.emit(baseEventName + '.consumers', offset_event);
				});
			});

			_consumer.on('end', function () {
				debug('consumer ' + _consumer.getName() + ' gone away');
				_.remove(offset_event, function (v) {
					return v.group === _consumer.getName();
				});
				events.emit(baseEventName + '.consumers', offset_event);
			});
		});

		callback();
	};

	function init_kafka_client(callback) {
		var zkConnect;
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

			async.series([
				function (callback) {
					init_kafka_client(callback);
				},
				function (callback) {
					return callback();
					zookeeper_monitor(callback);
				},
				function (callback) {
					return callback();
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

