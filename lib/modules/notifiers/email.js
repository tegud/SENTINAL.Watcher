var nodemailer = require("nodemailer");
var _ = require('lodash');
var async = require('async');
var transport;
var defaultAddresses = {};

module.exports = {
	configure: function(config, callback) {
		console.log('Configuring Email notifier...');
		console.log('SMTP Server set to ' + config.server);

		transport = nodemailer.createTransport("SMTP", {
	    	host: config.server
	    });

	    defaultAddresses = _.extend({}, defaultAddresses, config.defaults);

		callback();
	},
	notify: function(event, notifierConfig) {
		async.waterfall([
				function(callback) {
					var html = '';

					var emailOptions = {
						from: notifierConfig.from || defaultAddresses.from,
						to: notifierConfig.to,
						cc: notifierConfig.cc,
						bcc: notifierConfig.bcc,
						subject: notifierConfig.subject,
						html: JSON.stringify(event, null, 4)
					};

					callback(null, emailOptions);
				},
				transport.sendMail
			], function(err, response) {
				if(err){
					console.log(err);
				} else {
					console.log("Message sent: " + response.message);
				}
			});
	}
};
