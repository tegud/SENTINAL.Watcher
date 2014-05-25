var moment = require('moment');
var timeRegex = /^([0-9]+) ([a-z]+)$/i;

module.exports = function(timeString) {
	var timeMatch = timeString.match(timeRegex);
	
	if(timeMatch && timeMatch.length > 2) {
		duration = moment.duration(parseInt(timeMatch[1], 10), timeMatch[2]);
	}

	return duration;
};
