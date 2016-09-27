var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');

module.exports = function() {
	return {
		configure: function(config, callback) {

			callback();
		},
		notify: function(eventName, event, notifierConfig) {
			async.waterfall([
					async.apply(async.parallel, [
							async.apply(buildEmailOptions, event, notifierConfig),
							async.apply(templating.render, path.join(templateDir, notifierConfig.template), event)
						]),
					attachEmailBodyToOptions,
					transport.sendMail
				], notifyComplete);
		}
	};

};
