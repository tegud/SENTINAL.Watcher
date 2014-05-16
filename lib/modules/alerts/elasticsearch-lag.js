var elasticsearch = require('elasticsearch');
var moment = require('moment');
var _ = require('lodash');

var Recorder = require('../../recorder');
var events = require('../../events');
var notifiers = require('../../modules/notifiers');
var sources = require('../../modules/sources');
var schedulers = require('../../modules/schedulers');

var eventName = 'elasticsearch-lag';

module.exports = function() {
	var lagLimit;
	var query;
	var recorder;
	var scheduler;
	var notifierConfig;
	var instanceName;

	function checkResult() {
		var thresholdBreached = false;
		var result = recorder.getLastResult();

		if(result.millisecondsBehind > lagLimit) {
			thresholdBreached = true;
		}

		events.emit(eventName, {
			event: {
				raised: new Date(),
				level: thresholdBreached ? 'breach' : 'info',
				info: _.extend({
					limit: { max: lagLimit },
					breached: thresholdBreached
				}, result)
			},
			notifierConfig: notifierConfig
		});
	}

	function check(callback) {
		var todaysDate = moment().format('YYYY.MM.DD');
		var yesterdaysDate = moment().subtract('days', 1).format('YYYY.MM.DD');

		source
			.search({
				index: 'logstash-' + todaysDate + ',logstash-' + yesterdaysDate,
				options: {
					query: query,
					numberOfResults: 1
				}
			})
			.then(function (response) {
				var millisecondsBehind;
				var recordTimestamp;

				if (response.hits.hits.length) {
					var recordTimestamp = moment(response.hits.hits[0]['_source']['@timestamp']);
					
					millisecondsBehind = moment().diff(recordTimestamp, 'ms');
				}

				recorder.record({
					millisecondsBehind: millisecondsBehind,
					lastEventTimeStamp: recordTimestamp,
					lastEventAtFormatted: recordTimestamp.format('Do MMM YYYY, HH:mm:ss')
				});

				checkResult(callback);
			});

		scheduler.scheduleNext();
	}

	return {
		configure: function(config, callback) {
			lagLimit = config.limit || 10000;
			query = config.query;
			recorder = new Recorder({ maxRecords: 1 });
			scheduler = schedulers.createFromConfig(config.schedule, check);
			notifierConfig = config.notifications;
			instanceName = config.name;
			source = sources.getSource(config.source);

			notifiers.registerAlertNotifications(eventName, notifierConfig);

			callback();
		},
		initialise: function(callback) {
			console.log('Starting elasticsearch-lag alert: ' + instanceName);

			scheduler.start();

			callback();
		}
	};
};