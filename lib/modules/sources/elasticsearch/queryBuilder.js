var moment = require('moment');
var _ = require('lodash');
var timeRangeFromwNow = require('../../../utilities/timeRangeFromNow');
var objectUtils = require('../../../utilities/object');

function query() {
	var baseQuery = { };
	var self = {
		setSize: function(size) {
			baseQuery.size = size;

			return self;
		},
		addQuery: function(query) {
			objectUtils.setDeepProperty(baseQuery, 'query.filtered.query.bool.should', []);

			baseQuery.query.filtered.query.bool.should.push({ 
				'query_string': { 
					'query': query 
				} 
			});

			return self;
		},
		addFilter: function(options) {
			var filter = {};
			filter[options.type] = {};
			filter[options.type][options.field] = {
				from: options.from,
				to: options.to
			};

			objectUtils.setDeepProperty(baseQuery, 'query.filtered.filter.bool.must', []);

			baseQuery.query.filtered.filter.bool.must.push(filter);

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
	var builtQuery = new query()
		.addQuery(options.query)
		.setSize(options.numberOfResults)
		.sortBy('@timestamp', 'desc');

	if(options.time) {
		var range = new timeRangeFromwNow(options.time);

		builtQuery.addFilter(_.extend({
			type: 'range',
			field: '@timestamp'
		}, range));
	}

	return builtQuery.build();
};
