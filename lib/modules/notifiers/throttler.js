var moment = require('moment');
var stringToDuration = require('../../utilities/stringToDuration');

var nullThrottler = function() {
	return function(task) {
		task();
	};
};

var onceEvery = function(msLimit) {
	var lastEvent;

	if(typeof msLimit === 'string') {
		msLimit = stringToDuration(msLimit).asMilliseconds();
	}

	return function (task) {
		var withinDebouncePeriod = false;
		var now = moment();

		if(lastEvent && now.diff(lastEvent, 'ms') < msLimit) {
			withinDebouncePeriod = true;
		}

		if(!withinDebouncePeriod) {
			lastEvent = now;
		}
		else {
			return;
		}		

		task();
	};
}

module.exports = function(limitTo) {
	if(!limitTo) {
		return nullThrottler();
	}

	if(limitTo.onceEvery) {
		return onceEvery(limitTo.onceEvery);
	}

	return nullThrottler;
};
