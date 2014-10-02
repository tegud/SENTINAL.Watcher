module.exports = function() {
	return {
		initialise: function(callback) {
			console.log('Starting console notifier...')
			callback();
		},
		notify: function(eventName, event) {
			console.log("New event received: " + JSON.stringify(event, null, 4));
		}
	};
};
