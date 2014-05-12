var fs = require('fs');
var async = require('async');

module.exports = {
	render: function(view, viewModel, callback) {
		async.waterfall([
				async.apply(fs.readFile, view, 'utf-8'),
				function(template, callback) {
					callback(null, template);
				}
			], callback);
	}
};
