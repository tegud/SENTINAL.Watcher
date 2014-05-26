var moment = require('moment');

var url = function(base) {
	var url = base;
	var urlHasQueryString = url.indexOf('?') > -1;

	return {
		appendParameter: function(key, value) {
			if(urlHasQueryString) {
				url += '&';
			}
			else {
				url += '?';
				urlHasQueryString = true;
			}

			url += key + '=' + value;
		},
		get: function() {
			return url;
		}
	};
};

var adjustmentRegex = /event(\+|-)([0-9]+)([a-z])/i;

function parseEventRelativeString(input) {
	var adjustmentMatches =  input.match(adjustmentRegex);
	var operator = adjustmentMatches[1] === '-' ? 'subtract' : 'add';
	var amount = parseInt(adjustmentMatches[2], 10);
	var unit = adjustmentMatches[3];

	return {
		operator: operator,
		amount: amount,
		unit: unit
	};
}

function appendTimePropertyFromConfig(kibanaLink, event, config, property) {
	var value = config[property];

	if(!value) {
		return;
	}

	if(value.indexOf('event') === -1) {
		kibanaLink.appendParameter(property, value);
		return;
	}

	var parsedRelativeString = parseEventRelativeString(value);

	value = moment(event.raised)[parsedRelativeString.operator](parsedRelativeString.amount, parsedRelativeString.unit);

	kibanaLink.appendParameter(property, value.utc().format('YYYY-MM-DD HH:mm:00Z'));
}

var appendToEvent = function(config, event, callback) {
	var kibanaLink = url(config.baseLink);

	appendTimePropertyFromConfig(kibanaLink, event, config, 'from');
	appendTimePropertyFromConfig(kibanaLink, event, config, 'to');

	event.info.kibanaLink = kibanaLink.get();

	callback(null, event);
};

module.exports = function(config) {
	return appendToEvent.bind(undefined, config);
};
