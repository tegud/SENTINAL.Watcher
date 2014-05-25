var _ = require('lodash');
var async = require('async');
var moment = require('moment');

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
	var baseEventInfo = {};

	function check() {
		source.search({
			index: logstash.dateToIndex('today,yesterday'),
			options: query
		}).then(function (response) {
			var now = moment();
			var mappedResult = _.reduce(mappers, function(memo, mapper) {
				var mapping = mapper.map(response);

				return _.extend(memo, mapping);
			}, {});

			recorder.record(mappedResult);

			var thresholdResults = _.map(thresholds, function(threshold){
				return threshold.checkValue();
			});

			var breaches = _.filter(thresholdResults, function(threshold) {
				return threshold.breached;
			});

			var eventInfo = _.extend({
				matchedThreshold: _.first(breaches),
				thresholds: thresholdResults
			}, baseEventInfo, mappedResult);

			var eventLevel = eventInfo.matchedThreshold ? eventInfo.matchedThreshold.level : 'info';

			if(eventLevel === 'critical') {
				eventInfo.quantityText = 'critical';
			}
			else if (eventLevel === 'breach') {
				eventInfo.quantityText = 'high';
			}
			else {
				eventInfo.quantityText = 'normal';
			}

			if(eventInfo.kibanaLink) {
				var kibanaFrom = moment(now).subtract(10, 'minutes').format('YYYY-MM-DD HH:mm:00 Z');
				var kibanaTo = moment(now).add(10, 'minutes').format('YYYY-MM-DD HH:mm:00 Z');
				eventInfo.kibanaLink += (eventInfo.kibanaLink.indexOf('?') > -1 
					&& eventInfo.kibanaLink.indexOf('.json') < 0 ? '&' : '?') + 'from=' + kibanaFrom + '&to=' + kibanaTo; 
			}

			events.emit(eventName, {
				event: {
					raised: now.utc().toDate(),
					level: eventLevel,
					info: eventInfo 
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

			baseEventInfo = {
				site: config.site,
				timePeriod: config.query.time,
				kibanaLink: config.kibanaLink
			};

			callback();
		},
		initialise: function(callback) {
			scheduler.start();

			callback();
		}
	};
};