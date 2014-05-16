var moment = require('moment');

module.exports = function(options) {
	var searchBody = {
		"query": {
			"filtered": {
				"query": {
					"bool": {
						"should": [
							{
								"query_string": { "query": options.query }
							}
						]
					}
				}
			}
		},
		"size": options.numberOfResults,
		"sort": [
			{
				"@timestamp": {
					"order": "desc"
				}
			}
		]
	};

	if(options.time) {
		var now = moment();
		var timeGroups = options.time.match(/([0-9]+) ([a-z]+)/i);
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

	return searchBody;
};
