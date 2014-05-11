module.exports = {
	createFromConfig: function(config, task) {
		var schedulerModule = 'nullScheduler';

		if(config) {
			if(config.repeatEvery) {
				schedulerModule = 'repeatEveryScheduler';
			}
		}

		return new require('./' + schedulerModule)(config, task);
	}
};
