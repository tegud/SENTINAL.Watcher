var kafka = require('kafka-node'),
    debug = require('debug')('sentinel:alerts:kafka-check:producer');

module.exports = function (client, topic, partitions, message, callback) {
	var producer = new kafka.Producer(client);

	var cbCalled = false;
	var cbGuard = function (err) {
		if (!cbCalled) {
			cbCalled = true;
			callback();
		}
	}

	var payloads = [];
	for (var i = 0; i < partitions; i++) {
		payloads.push({
			topic: topic,
			partition: i,
			messages: [message]
		});
	}

	var sendPayload = function() {
		debug(topic + ' payload : ', payloads);

		producer.send(payloads, function (err, data) {
			if (err) {
				debug("error", err);
				return cbGuard(err);
			}
			debug("send()", data);
			cbGuard();
		});
	}

	producer.on("ready", function () {
		debug('producer ready');

		sendPayload();
	});
	
	producer.on("error", function(err) {
		debug("producer error : " + topic, err);
		cbGuard(err);
	});

	if(producer.ready){
		debug('producer already ready');

		sendPayload();
	}
};

