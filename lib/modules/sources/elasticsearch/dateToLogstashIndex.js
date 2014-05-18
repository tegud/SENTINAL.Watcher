var _ = require('lodash');
var moment = require('moment')

var dayOffsets = {
	'today': 0,
	'yesterday': -1
};

module.exports = function(date) {
	if(date.indexOf(',')) {
		date = date.split(',');
	}
	else {
		date = [date];
	}

	var indicies = _.map(date, function(currentDate) {
		var currentMoment;
		var indexDate;

		if(dayOffsets.hasOwnProperty(currentDate)) {
			var currentMoment = moment();

			currentMoment = currentMoment.add('days', dayOffsets[currentDate]);

			indexDate = currentMoment.utc().format('YYYY.MM.DD');
		}
		else {
			indexDate = currentDate;
		}
		return 'logstash-' + indexDate;
	});

	

	return indicies.join(',');
};
