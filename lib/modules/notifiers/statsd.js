var dgram = require('dgram'),
    debug = require('debug')('sentinel:notifier:statsd');

module.exports = function () {
	var endpoint = {
		host: "localhost",
		port: 8125
	};

	function sendPacket(event) {
		var buf = new Buffer(event.metricName + ':' + event.code + '|g');
		var s = dgram.createSocket('udp4');
		s.send(buf, 0, buf.length, endpoint.port, endpoint.host, function (err) {
			s.close();
		});
	};

	return {
		configure: function (config, callback) {
			debug('configuring');

			if (config.endpoint) {
				endpoint = config.endpoint;
			}

			callback();
		},
		initialise: function (callback) {
			callback();
		},
		notify: function (eventName, event) {
			console.log("would send to statsd here", event);
			sendPacket(event);
		}
	};
};

