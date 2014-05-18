var _ = require('lodash');
var async = require('async');

var Recorder = require('../../recorder');
var events = require('../../events');
var notifiers = require('../../modules/notifiers');
var sources = require('../../modules/sources');
var schedulers = require('../../modules/schedulers');
var logstash = require('../../utilities/logstash');

var moduleName = 'elasticsearch-simple-query';

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

	function check() {
		source.search({
			index: logstash.dateToIndex('today,yesterday'),
			options: query
		}).then(function (response) {
			var mappedResult = _.reduce(mappers, function(memo, mapper) {
				var mapping = mapper.map(response);

				return _.extend(memo, mapping);
			}, {});

			recorder.record(mappedResult);

			var thresholdResults = _.map(thresholds, function(threshold){
				return threshold.checkValue();
			});

			var breach = _.some(thresholdResults, function(threshold) {
				return threshold.breached;
			});

			events.emit(eventName, {
				event: {
					raised: new Date(),
					level: breach ? 'breach' : 'info',
					info: _.extend({
						thresholds: thresholdResults
					}, mappedResult)
				},
				notifierConfig: notifierConfig
			});

			scheduler.scheduleNext();
		});
	}

	return {
		configure: function(config, callback) {
			eventName = moduleName + '.' + config.name;

			name = config.name;

			query = config.query;
			recorder = new Recorder({ maxRecords: 1 });
			scheduler = schedulers.createFromConfig(config.schedule, check);
			notifierConfig = config.notifications;
			source = sources.getSource(config.source);

			mappers = _.map(config.mappers, loadMapper);
			thresholds = _.map(config.thresholds, async.apply(loadThreshold, recorder));

			notifiers.registerAlertNotifications(eventName, notifierConfig);

			callback();
		},
		initialise: function(callback) {
			scheduler.start();

			callback();
		}
	};
};