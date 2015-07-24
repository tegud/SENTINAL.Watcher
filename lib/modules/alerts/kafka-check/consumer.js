var kafka = require('kafka-node'),
    async = require('async'),
    debug = require('debug')('sentinel:alerts:kafka-check:consumer');

module.exports = function(client, topic, partitions, message, callback) {
	var consumer_payloads = [{topic: topic, offset: -1}],
	    consumer_options = {groupId: 'healthcheck', fromOffset: false};

	var received = 0,
	    target_bitmap = Math.pow(2, partitions) - 1,
	    callback_guard = false;

	try {
		var consumer = new kafka.HighLevelConsumer(client, consumer_payloads, consumer_options);
	}
	catch(err) {
		debug('create high level consumer error : ' + err);
		return;
	}
	
	consumer.on("message", function (consumer_message) {
		debug(consumer_message);

		if (consumer_message.value == message) {
			debug('consumed test message');
			received |= Math.pow(2, consumer_message.partition);

			if (received == target_bitmap) {
				async.series([
					function (cb) {
						consumer.commit(true, cb);
					},
					function (cb) {
						consumer.close(true, cb);
					}
				], function (err, results) {
					if (!callback_guard) {
						callback_guard = true;
						callback(err);
					}
				});
			}
		}
	});

	consumer.on("error", function (err) {
		debug("consumer error", err);
		if (!callback_guard) {
			callback_guard = true;
			callback(err);
		}
	});
};

