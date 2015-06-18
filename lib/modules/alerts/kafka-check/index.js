var debug = require('debug')('sentinel:alerts:kafka-check:index'),
    events = require('../../../events'),
    notifiers = require('../../../modules/notifiers'),
    schedulers = require('../../../modules/schedulers'),
    topicChecker = require('./topicChecker'),
    tcpChecker = require('./tcpChecker');

var moduleName = 'kafka-check';

module.exports = function () {
	var notifierConfig,
	    scheduler,
	    brokers,
            zookeepers;
	var baseEventName;

	function check() {
		topicChecker(zookeepers, 'healthcheck', 3, function (result) {
			var eventInfo = {
				level: "info",
				metricName: "qa.kafka.healthcheck",
				code: result
			};

			events.emit(baseEventName + '.topic-check-per-broker', eventInfo);
		});
		topicChecker(zookeepers, 'replicated_healthcheck', 1, function (result) {
			var eventInfo = {
				level: "info",
				metricName: "qa.kafka.replicated_healthcheck",
				code: result
			};

			events.emit(baseEventName + '.topic-check', eventInfo);
		});
		tcpChecker(brokers, function (err, result) {
			debug("tcpChecker", "kafka brokers", result);
			var eventInfo = {
				level: "info",
				metricName: "qa.kafka.brokers",
				status: result
			};
			events.emit(baseEventName + '.broker-status', eventInfo);
		});
		tcpChecker(zookeepers, function (err, result) {
			debug("tcpChecker", "zookeepers", result);
			var eventInfo = {
				level: "info",
				metricName: "qa.kafka.zookeepers",
				status: result
			};
			events.emit(baseEventName + '.zookeeper-status', eventInfo);
		});
		scheduler.scheduleNext();
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

			callback();
		},
		initialise: function (callback) {
			scheduler.start();
			callback();
		}
	};
};

