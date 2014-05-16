var moment = require('moment');

module.exports = function(timeString) {
	var now = moment();
	var timeGroups = options.time.match(/([0-9]+) ([a-z]+)/i);
	var quantity = parseInt(timeGroups[1], 10);
	var unit = timeGroups[2];
	var from = moment(now).subtract(unit, quantity).valueOf();

	return {
		from: from,
		to: now.valueOf()
	};
};
