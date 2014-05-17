var moment = require('moment');
var _ = require('lodash');

module.exports = function(config) {
	return {
		map: function(resultSet) {
			var mappedResponse = {};
			var millisecondsBehind = -1;
			var recordTimestamp;

			if (resultSet.hits.hits.length) {
				var recordTimestamp = moment(resultSet.hits.hits[0]['_source']['@timestamp']);
				
				millisecondsBehind = moment().diff(recordTimestamp, 'ms');
			}

			mappedResponse[config.propertyName || 'millisecondsAgo'] = millisecondsBehind;

			return _.extend({
				lastEventTimeStamp: recordTimestamp,
				lastEventAtFormatted: recordTimestamp.format('Do MMM YYYY, HH:mm:ss')
			}, mappedResponse);
		}
	};
};
