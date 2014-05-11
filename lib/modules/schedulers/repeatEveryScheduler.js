module.exports = function repeatEveryScheduler(config, task) {
	var timeout;

	function scheduleNext() {
		timeout = setTimeout(task, config.repeatEvery);
	}

	return {
		scheduleNext: scheduleNext,
		start: function() {
			if(config.runImmediately) {
				setImmediate(task);
			}
			else {
				scheduleNext();
			}
		},
		stop: function() {
			clearTimeout(timeout);
		}
	};
};
