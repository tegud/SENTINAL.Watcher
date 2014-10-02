module.exports = function repeatEveryScheduler(config, task) {
	var timeout;

	function scheduleNext() {
		timeout = setTimeout(task, config.repeatEvery);
	}

	return {
		scheduleNext: scheduleNext,
		start: function() {
            console.log("Starting schedule: " + JSON.stringify(config));
			if(config.runImmediately) {
				setImmediate(task);
			}
			else {
				scheduleNext();
			}
		},
		stop: function() {
            console.log("Stopping schedule: " + JSON.stringify(config));
			clearTimeout(timeout);
		}
	};
};
