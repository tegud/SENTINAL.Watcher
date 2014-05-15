module.exports = function() {
	return {
		initialise: function(callback) {
			console.log('Starting console notifier...')
			callback();
		},
		notify: function(event) {
			console.log(JSON.stringify(event, null, 4));
		}
	};
};
