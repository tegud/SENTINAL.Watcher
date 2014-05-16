var moment = require('moment');

function setDeepProperty(obj, propertyString, propertyDefaultValue) {
	var propertyStringParts = propertyString.split('.');
	var splitLength = propertyStringParts.length;
	var x = 0;

	for(;x < splitLength;x++) {
		var isLastValue = x === (splitLength - 1)

		if(!obj[propertyStringParts[x]]) {
			obj[propertyStringParts[x]] = isLastValue ? propertyDefaultValue : {};
		}
	}

	return obj;
}

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
			setDeepProperty(baseQuery, 'filtered.query.bool.should', []);

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

			setDeepProperty(baseQuery, 'filtered.filter.bool.must', []);

			baseQuery.filtered.filter.bool.must.push(filter);

			return self;
		},
		sortBy: function(field, direction) {
			var sort = {};

			sort[field] = {
				order: direction
			};

			setDeepProperty(baseQuery, 'sort', []);

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
		var now = moment();
		var timeGroups = options.time.match(/([0-9]+) ([a-z]+)/i);
		var quantity = parseInt(timeGroups[1], 10);
		var unit = timeGroups[2];
		var from = moment(now).subtract(unit, quantity).valueOf();

		query.addFilter({
			type: 'range',
			field: '@timestamp',
			from: from,
			to: now.valueOf()
		});
	}

	return query.build();
};
