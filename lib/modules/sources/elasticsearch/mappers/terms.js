var _ = require('lodash');

module.exports = function(config) {
	return {
		map: function(resultSet) {
			var mappedResponse = {};

			console.log(resultSet.aggregations);

			mappedResponse[config.name] = _.map(resultSet.aggregations[config.name].buckets, function(bucket) {
				return {
					text: bucket.key,
					count: bucket.doc_count
				};
			});

			return mappedResponse;
		}
	};
};
