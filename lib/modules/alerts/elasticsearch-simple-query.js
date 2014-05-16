var elasticsearch = require('elasticsearch');
var moment = require('moment');
var _ = require('lodash');

var Recorder = require('../../recorder');
var events = require('../../events');
var notifiers = require('../../modules/notifiers');
var sources = require('../../modules/sources');
var schedulers = require('../../modules/schedulers');

module.exports = function() {
	var eventName = eventName;

	var lagLimit;
	var query;
	var client;
	var recorder;
	var scheduler;
	var notifierConfig;
	var time;
	var numberOfResults;
	var name;
	var source;

	function checkResult() {
		var thresholdBreached = false;
		var result = recorder.getLastResult();

		if(result > lagLimit) {
			thresholdBreached = true;
		}

		events.emit(eventName + '.' + name, {
			event: {
				raised: new Date(),
				level: thresholdBreached ? 'breach' : 'info',
				name: name,
				info: _.extend({
					errors: result,
					limit: { max: lagLimit },
					breached: thresholdBreached
				}, result)
			},
			notifierConfig: notifierConfig
		});
	}

	function check(callback) {
		var now = moment();
		var todaysDate = now.format('YYYY.MM.DD');
		var yesterdaysDate = moment(now).subtract('days', 1).format('YYYY.MM.DD');
		var from;

		var searchBody = {
			"query": {
				"filtered": {
					"query": {
						"bool": {
							"should": [
								{
									"query_string": { "query": query }
								}
							]
						}
					}
				}
			},
			"size": numberOfResults,
			"sort": [
				{
					"@timestamp": {
						"order": "desc"
					}
				}
			]
		};

		if(time) {
			var timeGroups = time.match(/([0-9]+) ([a-z]+)/i);
			var quantity = parseInt(timeGroups[1], 10);
			var unit = timeGroups[2];
			var from = moment(now).subtract(unit, quantity).valueOf();

			searchBody.query.filtered['filter'] = {
				"bool": {
					"must": [
						{
							"range": {
								"@timestamp": {
									"from": from,
									"to": now.valueOf()
								}
							}
						}
					]
				}
			};
		}

		source.search({
			index: 'logstash-' + todaysDate + ',logstash-' + yesterdaysDate,
			body: searchBody
		}).then(function (response) {
			var millisecondsBehind;
			var recordTimestamp;

			recorder.record(response.hits.hits.length);

			checkResult(callback);
		});

		scheduler.scheduleNext();
	}

	return {
		configure: function(config, callback) {
			lagLimit = config.limit || 10000;
			query = config.query;
			client = new elasticsearch.Client({
				host: config.host
			});
			recorder = new Recorder({ maxRecords: 1 });
			scheduler = schedulers.createFromConfig(config.schedule, check);
			notifierConfig = config.notifications;
			time = config.time;
			numberOfResults = config.limitResultsTo;
			name = config.name;
			source = sources.getSource(config.source);

			notifiers.registerAlertNotifications(eventName + '.' + name, notifierConfig);

			callback();
		},
		initialise: function(callback) {
			scheduler.start();

			callback();
		}
	};
};