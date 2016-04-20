var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var Promise = require('bluebird');
var http = require('http');

var Recorder = require('../../../recorder');
var events = require('../../../events');
var notifiers = require('../../../modules/notifiers');
var sources = require('../../../modules/sources');
var schedulers = require('../../../modules/schedulers');
var logstash = require('../../../utilities/logstash');

var serverCheck = require('./serverCheck');
var checkRequest = require('./checkRequest');
var ClusterState = require('./clusterState');

var moduleName = 'elasticsearch-health';

function loadMapper (mapperConfig) {
	return require('../sources/elasticsearch/mappers/' + mapperConfig.type)(mapperConfig);
}

function loadThreshold (recorder, thresholdConfig) {
	if(thresholdConfig.type[0] === '.') {
		return new require('./thresholds/' + thresholdConfig.type)(recorder, thresholdConfig);
	}

	return new require('../../thresholds/' + thresholdConfig.type)(recorder, thresholdConfig);
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
	var esCurrentState;

	function checkThresholdsAndEmitEvent(result) {
		var now = moment();

		result.timestamp = now;

		recorder.record(result);

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

	function serverPromise(server) {
		return new Promise(serverCheck.bind(undefined, esCurrentState, checks, server));
	}

	function getNodeStats() {
		return new Promise(function(resolve, reject) {
			var serverIds = _.chain(esCurrentState.getCurrentState().nodes).filter(function(node) {
				return node.id;
			}).pluck('id').value();

			if(!serverIds.length) {
				resolve();
			}

			checkRequest('logs.laterooms.com', '/_nodes/' + serverIds.join(',') + '/stats', 'nodeStats', 10000).then(function(data) {
				if(data && data.result && data.result.nodes) {
					esCurrentState.setNodeStatus(data.result.nodes);
				}
				resolve();
			});
		});
	}

	function allChecksComplete() {
		checkThresholdsAndEmitEvent(esCurrentState.getCurrentState());
	}

	function check() {
		var checkPromises = _.map(servers, serverPromise);

		Promise
			.all(checkPromises)
			.then(getNodeStats)
			.then(allChecksComplete);
	}

	var serverState;

	return {
		configure: function(config, callback) {
			servers = config.servers;

			esCurrentState = new ClusterState(servers, { maxAllowedTimeout: maxAllowedTimeout });

			checks = {
				state: '/_cluster/state/master_node,nodes,routing_table',
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
				return new require('../../eventBuilders/' + config.type)(config);
			});

			eventBuilders.push(new require('../../eventBuilders/staticProperties')({
				'info.clusterName': config.clusterName
			}));

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
