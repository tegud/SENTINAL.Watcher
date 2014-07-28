var appendToEvent = function(config, event, callback) {
	if(!config.levels) {
		config.levels = {};
	}

	event.info.quantityText = config.levels[event.level] || config.defaultValue; 

	callback(null, event);
};

module.exports = function(config) {
	return appendToEvent.bind(undefined, config);
};
