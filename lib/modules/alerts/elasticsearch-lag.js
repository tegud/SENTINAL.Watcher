var elasticsearch = require('elasticsearch');
var moment = require('moment');
var Recorder = require('../../recorder');
var events = require('../../events');
var notifiers = require('../../modules/notifiers');
var schedulers = require('../../modules/schedulers');

var lagLimit;
var query;
var client;
var recorder;
var scheduler;
var notifierConfig;

function checkResult() {
	var thresholdBreached = false;
	var result = recorder.getLastResult();

	if(result > lagLimit) {
		thresholdBreached = true;
	}

	events.emit('elasticsearch-lag', {
		event: {
			raised: new Date(),
			level: thresholdBreached ? 'breach' : 'info',
			info: {
				result: result,
				limit: { max: lagLimit },
				breached: thresholdBreached
			}
		},
		notifierConfig: notifierConfig
	});
}

function check(callback) {
	var todaysDate = moment().format('YYYY.MM.DD');

		client
			.search({
				index: 'logstash-' + todaysDate,
				body: {
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
					"size": 1,
					"sort": [
						{
							"@timestamp": {
								"order": "desc"
							}
						}
					]
				}
			})
			.then(function (response) {
				var millisecondsBehind;

				if (response.hits.hits.length) {
					var recordTimestamp = moment(response.hits.hits[0]['_source']['@timestamp']);
					
					millisecondsBehind = moment().diff(recordTimestamp, 'ms');
				} else {
					// No data for today, TODO: work out how far into the day is, or query the day before.
				}

				recorder.record(millisecondsBehind);

				checkResult(callback);
			});

	scheduler.scheduleNext();
}

module.exports = {
	configure: function(config, callback) {
		lagLimit = config.limit || 10000;
		query = config.query;
		client = new elasticsearch.Client({
			host: config.host
		});
		recorder = new Recorder({ maxRecords: 1 });
		scheduler = schedulers.createFromConfig(config.schedule, check);
		notifierConfig = config.notifications;

		notifiers.registerAlertNotifications('elasticsearch-lag', notifierConfig);

		callback();
	},
	initialise: function(callback) {
		scheduler.start();

		callback();
	}
};