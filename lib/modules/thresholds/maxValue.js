var _ = require('lodash');

module.exports = function(recorder, config) {
	return {
		checkValue: function() {
			var thresholdBreached = false;
			var result = recorder.getLastResult();

			if(config.field) {
				result = result[config.field];
			}

			if(result > config.limit) {
				thresholdBreached = true;
			}

			return {
				level: (config.level || 'breach'),
				threshold: (config.field || 'value') + ' > ' + config.limit,
				maxValue: config.limit,
				breached: thresholdBreached
			};
		}
	};
};
