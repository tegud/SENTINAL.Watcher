module.exports = function(config) {
	var recordings = [];

	return {
		record: function(result) {
			recordings.unshift(result);

			if(recordings.length > config.maxRecordings) {
				recordings.pop();
			}
		},
		getResults: function() {
			return recordings;
		},
		getLastResult: function() {
			return recordings[0];
		}
	};
};
