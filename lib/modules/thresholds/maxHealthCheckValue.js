var _ = require('lodash');

module.exports = function(recorder, config) {
	return {
		checkValue: function() {
			var thresholdBreached = false;
			var result = recorder.getLastResult();

			result = _.reduce(result.serverSetCounts, function(memo, group, groupName) {
				var breachedList = _.reduce(group, function(memo, subGroup, subGroupName) {
						if (subGroup[config.status] >= config.limit) {
							memo[subGroupName] = 'breach';
						}
						return memo;
					}, {});

					if(Object.keys(breachedList).length > 0) {
						memo[groupName] = breachedList;
					}
					return memo;
				}, {});

			if(Object.keys(result).length > 0) {
				thresholdBreached = true;
			}

			return {
				level: (config.level || 'breach'),
				threshold: (config.status || 'value') + ' > ' + config.limit,
				maxValue: config.limit,
				result: result,
				breached: thresholdBreached
			};
		}
	};
};
