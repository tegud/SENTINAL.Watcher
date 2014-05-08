var elasticsearch = require('elasticsearch');
var moment = require('moment');
var Recorder = require('../recorder');
var events = require('../events');

var lagLimit;
var query;
var client;
var recorder;

function checkResult(callback) {
	var thresholdBreached = false;
	var result = recorder.getLastResult();

	if(result > lagLimit) {
		thresholdBreached = true;
	}

	events.emit('alert-check', {
		name: 'elasticsearch-lag',
		raised: new Date(),
		info: {
			result: result,
			expected: lagLimit,
			breached: thresholdBreached
		}
	});

	callback();
}

module.exports = {
	configure: function(config, callback) {
		lagLimit = config.limit || 10000;
		query = config.query;
		client = new elasticsearch.Client({
			host: config.host
		});
		recorder = new Recorder({ maxRecords: 1 });

		callback();
	},
	check: function(callback) {
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
	}
};