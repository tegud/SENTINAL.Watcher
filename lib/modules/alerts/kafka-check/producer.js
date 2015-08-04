var kafka = require('kafka-node'),
    debug = require('debug')('sentinel:alerts:kafka-check:producer');

module.exports = function (client, topic, partitions, message, callback) {
	var producer = new kafka.Producer(client);
	producer.on("error", function(err) {
		debug("producer error : " + topic, err);
		cbGuard(err);
	});


	var cbCalled = false;
	var cbGuard = function (err) {
		if (!cbCalled) {
			cbCalled = true;
			delete producer;
			callback();
		}
	}

	var sendPayload = function() {

		var payloads = [];
		for (var i = 0; i < partitions; i++) {
			payloads.push({
				topic: topic,
				partition: i,
				messages: [message]
			});
		}

		debug(topic + ' payload : ', payloads);

		producer.send(payloads, function (err, data) {
			if (err) {
				debug("error", err);
				return cbGuard(err);
			}
			cbGuard();
		});
	}

	sendPayload();
};

