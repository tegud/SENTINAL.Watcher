var _ = require('lodash');
var objectUtils = require('../../utilities/object');

function getThreshold(value) {
	if(typeof value === 'number') {
		return value;
	}

	var matchedNumber = /([0-9]+(\.[0-9]+)?)(.*)/gi.exec(value + '');

	if(!matchedNumber) {
		return value;
	}

	var number = matchedNumber[1];
	var units = matchedNumber[3];

	if(matchedNumber[2]) {
		number = parseFloat(number);
	}
	else {
		number = parseInt(number, 10);
	}

	if(units) {
		if(units === 'gb') {
			return number * 1024 * 1024 * 1024;
		}
	}

	return number;
}

module.exports = function(recorder, config) {
	var limit = getThreshold(config.limit);

	return {
		checkValue: function(value) {
			var thresholdBreached = false;
			var result = value || recorder.getLastResult();

			if(config.field) {
				result = objectUtils.getValueFromSubProperty(result, config.field);
			}

			if(result > limit) {
				thresholdBreached = true;
			}

			return {
				level: (config.level || 'breach'),
				threshold: (config.field || 'value') + ' > ' + limit,
				value: result,
				maxValue: limit,
				breached: thresholdBreached
			};
		}
	};
};
