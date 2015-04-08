var _ = require('lodash');

var functionRegex = /\:([a-z]+)\(([^=]+)=([^)]+)\)/ig;

var fn = {
	'find': function(obj, key, val) {
		var matching = _.filter(obj, function(current) {
			return current[key] === val;
		});

		return matching[0];
	}
};

module.exports = {
	setDeepProperty: function (obj, propertyString, propertyDefaultValue) {
		var propertyStringParts = propertyString.split('.');
		var splitLength = propertyStringParts.length;
		var x = 0;
		var rootObj = obj

		for(;x < splitLength;x++) {
			var isLastValue = x === (splitLength - 1)

			if(!obj[propertyStringParts[x]]) {
				obj[propertyStringParts[x]] = isLastValue ? propertyDefaultValue : {};
			}

			obj = obj[propertyStringParts[x]];
		}

		return rootObj;
	},
	getValueFromSubProperty: function(obj, property) {
		var valuePropertySegments = property.split('.');
		var segmentEscaper = /\|/ig;

		_.each(valuePropertySegments, function(segment) {
			var functionMatches = functionRegex.exec(segment);
			
			if(typeof obj === 'undefined') {
			}
			else if(functionMatches){
				obj = fn[functionMatches[1]](obj, functionMatches[2], functionMatches[3]);
			}
			else {
				obj = obj[segment.replace(segmentEscaper, ".")];
			}
		});

		return obj;
	}
};
