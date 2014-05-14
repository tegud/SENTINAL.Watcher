function noop() {}

module.exports = function nullScheduler() {
	return {
		scheduleNext: noop,
		start: noop,
		stop: noop
	};
};
