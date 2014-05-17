var elasticsearch = require('elasticsearch');
var moment = require('moment');
var _ = require('lodash');

var Recorder = require('../../recorder');
var events = require('../../events');
var notifiers = require('../../modules/notifiers');
var sources = require('../../modules/sources');
var schedulers = require('../../modules/schedulers');

module.exports = function() {
	var eventName;
	var lagLimit;
	var query;
	var recorder;
	var scheduler;
	var notifierConfig;
	var time;
	var numberOfResults;
	var name;
	var source;
	var threshold;

	function check() {
		var now = moment();
		var todaysDate = now.format('YYYY.MM.DD');
		var yesterdaysDate = moment(now).subtract('days', 1).format('YYYY.MM.DD');

		source.search({
			index: 'logstash-' + todaysDate + ',logstash-' + yesterdaysDate,
			options: query
		}).then(function (response) {
			var millisecondsBehind;
			var recordTimestamp;

			recorder.record(response.hits.hits.length);

			events.emit(eventName, {
				event: threshold.checkValue(),
				notifierConfig: notifierConfig
			});
			scheduler.scheduleNext();
		});
	}

	return {
		configure: function(config, callback) {
			lagLimit = config.limit || 10000;
			query = config.query;
			recorder = new Recorder({ maxRecords: 1 });
			threshold = new require('../thresholds/maxValue')(recorder, {
				limit: config.limit
			});
			scheduler = schedulers.createFromConfig(config.schedule, check);
			notifierConfig = config.notifications;
			time = config.time;
			numberOfResults = config.limitResultsTo;
			name = config.name;
			source = sources.getSource(config.source);
			eventName = 'elasticsearch-simple-query.' + config.name;

			notifiers.registerAlertNotifications(eventName, notifierConfig);

			callback();
		},
		initialise: function(callback) {
			scheduler.start();

			callback();
		}
	};
};