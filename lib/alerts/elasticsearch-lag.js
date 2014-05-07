var elasticsearch = require('elasticsearch');
var moment = require('moment');

var lagLimit;
var query;
var client;

module.exports = {
	configure: function(config, done) {
		lagLimit = config.limit || 10000;
		query = config.query || 'lr_varnish_request';
		client = new elasticsearch.Client({
			host: config.host
		});

		done();
	},
	check: function(done) {
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

				if(millisecondsBehind > lagLimit) {
					// Raise Alert
				}

				done();
			});
	}
};