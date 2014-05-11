var nodemailer = require("nodemailer");
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
		var emailOptions = {
			from: options.from || defaultAddresses.from,
			to: options.to,
			cc: options.cc,
			bcc: options.bcc,
			subject: options.subject,
			text: options.text,
			html: options.html
		};

		transport.sendMail(options, function(error, response) {
			if(error){
				console.log(error);
			} else {
				console.log("Message sent: " + response.message);
			}
		});
	}
};
