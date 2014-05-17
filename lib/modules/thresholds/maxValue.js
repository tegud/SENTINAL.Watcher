var _ = require('lodash');

module.exports = function(recorder, config) {
	return {
		checkValue: function() {
			var thresholdBreached = false;
			var result = recorder.getLastResult();

			if(result > config.limit) {
				thresholdBreached = true;
			}

			return {
				raised: new Date(),
				level: thresholdBreached ? 'breach' : 'info',
				info: _.extend({
					errors: result,
					limit: { max: config.limit },
					breached: thresholdBreached
				}, result)
			};
		}
	};
};
