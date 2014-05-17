module.exports = function(config) {
	return {
		map: function(resultSet) {
			var mappedResponse = {};

			mappedResponse[config.propertyName] = resultSet.hits.hits.length;

			return mappedResponse;
		}
	};
};
