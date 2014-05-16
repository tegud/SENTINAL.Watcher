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
	}
};
