var debug = require('debug')('kafka-offsets'),
    kafka = require('kafka-node'),
    _ = require('lodash');

module.exports = function (zookeepers, topics, callback) {
	var client = new kafka.Client(zookeepers);
	var offset = new kafka.Offset(client);

	function buildPayloads(topics) {
		var payloads = [];
		var date = Date.now();
		_.forEach(topics, function (partitions, topic) {
			for (var i = 0; i < partitions; i++) {
				payloads.push({
					topic: topic,
					partition: i,
					time: date,
					maxNum: 1
				});
			}
		});
		return payloads;
	}

	offset.on('ready', function () {
		debug('offset request ready');

		offset.fetch(buildPayloads(topics), function (err, data) {
			if (err) {
				debug('error', err);
				return callback(err);
			}

			return callback(null, data);
		});
	});
};

