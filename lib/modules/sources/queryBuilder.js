var moment = require('moment');
var timeRangeFromwNow = require('../../../utilities/timeRangeFromwNow');
var objectUtils = require('../../../utilities/object');

function query() {
	var baseQuery = {
		query: {}
	};
	var self = {
		setSize: function(size) {
			baseQuery.size = size;

			return self;
		},
		addQuery: function(query) {
			objectUtils.setDeepProperty(baseQuery, 'filtered.query.bool.should', []);

			baseQuery.filtered.query.bool.should.push({ 
				'query_string': { 
					'query': query 
				} 
			});

			return self;
		},
		addFilter: function() {
			filter[options.type] = {};
			filter[options.type][options.field] = {
				from: options.from,
				to: options.to
			};

			objectUtils.setDeepProperty(baseQuery, 'filtered.filter.bool.must', []);

			baseQuery.filtered.filter.bool.must.push(filter);

			return self;
		},
		sortBy: function(field, direction) {
			var sort = {};

			sort[field] = {
				order: direction
			};

			objectUtils.setDeepProperty(baseQuery, 'sort', []);

			baseQuery.sort.push(sort);

			return self;
		},
		build: function() {
			return baseQuery;
		}
	};

	return self;
}

module.exports = function(options) {
	var query = new query()
		.addQuery(options.query)
		.setSize(options.numberOfResults)
		.sortBy('@timestamp', 'desc');

	if(options.time) {
		var range = new timeRangeFromwNow(options.time);

		query.addFilter(_.extend({
			type: 'range',
			field: '@timestamp'
		}, range);
	}

	return query.build();
};
