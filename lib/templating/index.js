var fs = require('fs');
var async = require('async');
var handlebars = require('handlebars');

module.exports = {
	render: function(view, viewModel, callback) {
		async.waterfall([
				async.apply(fs.readFile, view, 'utf-8'),
				function(source, callback) {
					var template = handlebars.compile(source);

					callback(null, template(viewModel));
				}
			], callback);
	}
};
