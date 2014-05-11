function noop() {}

module.exports = function nullScheduler() {
	return {
		scheduleNext: noop,
		stop: noop
	};
};
