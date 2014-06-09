var appendToEvent = function(config, event, callback) {
	callback(null, event);
};

module.exports = function(config) {
	return appendToEvent.bind(undefined, config);
};
