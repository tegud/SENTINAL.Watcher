var _ = require('lodash');

var objectUtils = require('../../utilities/object');

var appendToEvent = function(config, event, callback) {
	_.each(config, function(value, key) {
		objectUtils.setDeepProperty(event, key, value);
	});

	callback(null, event);
};

module.exports = function(config) {
	return appendToEvent.bind(undefined, config);
};
