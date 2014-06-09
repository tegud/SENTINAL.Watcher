var _ = require('lodash');

module.exports = function(recorder, config) {
	return {
		checkValue: function() {
			var isBreached;

			isBreached = recorder.getLastResults(config.limit).filter(function(result) {
				return result === 'exception';
			}).length >= config.limit;

			return {
				level: (config.level || 'exception'),
				breached: isBreached 
			};
		}
	};
};
