var nodemailer = require("nodemailer");
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var templating = require('../../templating');

module.exports = function() {
	var transport;
	var defaultAddresses = {};
	var templateDir;

	function buildEmailOptions(event, notifierConfig, callback) {
		var emailOptions = {
			from: notifierConfig.from || defaultAddresses.from,
			to: notifierConfig.to,
			cc: notifierConfig.cc,
			bcc: notifierConfig.bcc,
			subject: notifierConfig.subject,
			html: JSON.stringify(event, null, 4),
			event: event
		};

		callback(null, emailOptions);
	}

	function attachEmailBodyToOptions(results, callback) {
		var emailOptions = results[0];

		var jsonEventAttachment = JSON.stringify(emailOptions.event, null, 4);

		emailOptions.attachments = [{ 
			fileName: 'detail.json', 
			contents: jsonEventAttachment,
	        contentType: 'application/json'
		}];
		emailOptions.html = results[1];

		callback(null, emailOptions);
	}

	function notifyComplete(err, response) {
		if(err){
			console.log(err);
		} else {
			console.log("Message sent: " + response.message);
		}
	}

	return {
		configure: function(config, callback) {
			console.log('Configuring Email notifier...');
			console.log('SMTP Server set to ' + config.server);

			transport = nodemailer.createTransport("SMTP", {
		    	host: config.server
		    });

		    defaultAddresses = _.extend({}, defaultAddresses, config.defaults);

		    templateDir = path.normalize(__dirname + '../../../../' + config.templateDir + '/');

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
