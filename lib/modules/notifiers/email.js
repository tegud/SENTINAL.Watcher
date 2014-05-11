var nodemailer = require("nodemailer");
var _ = require('lodash');
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
	notify: function(options) {
		var event = options.event;
		var notifierConfig = options.notifierConfig || {};
		var emailOptions = {
			from: notifierConfig.from || defaultAddresses.from,
			to: notifierConfig.to,
			cc: notifierConfig.cc,
			bcc: notifierConfig.bcc,
			subject: notifierConfig.subject,
			text: options.text,
			html: options.html
		};

		console.log(emailOptions);

		transport.sendMail(emailOptions, function(error, response) {
			if(error){
				console.log(error);
			} else {
				console.log("Message sent: " + response.message);
			}
		});
	}
};
