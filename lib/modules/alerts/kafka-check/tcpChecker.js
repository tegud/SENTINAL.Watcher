var debug = require("debug")("sentinel:alerts:kafka-check:tcpChecker"),
    async = require("async"),
    net = require("net");

module.exports = function (endpoints, callback) {
	var results = async.map(endpoints, function (endpoint, cb) {
		function output(res) {
			return {
				endpoint: endpoint.host + ":" + endpoint.port,
				alive: res
			};
		}

		var s = net.createConnection(endpoint.port, endpoint.host, function (err) {
			debug("connect", endpoint.host, endpoint.port);
			cb(null, output(true));
			s.end();
	});
		s.on("error", function (err) {
			debug("error", endpoint.host, endpoint.port, err);
			cb(null, output(false));
			s.destroy();
		});
	}, function (err, results) {
		callback(null, results);
	});
};

