var kafka = require('kafka-node'),
    async = require('async'),
    debug = require('debug')('sentinel:alerts:kafka-check:consumer');

module.exports = function(consumerCounter, client, topic, partitions, message, callback) {
	var consumer_payloads = [{topic: topic, offset: -1}],
	    consumer_options = {groupId: topic + '_consumer', fromOffset: false};

	var received = 0,
	    target_bitmap = Math.pow(2, partitions) - 1,
	    callback_guard = false;

	try {
		var consumer = new kafka.HighLevelConsumer(client, consumer_payloads, consumer_options);
	}
	catch(err) {
		debug('create high level consumer error : ' + err);

		if (!callback_guard) {
			callback_guard = true;
			return callback(err);
		}
	}

	var consumer_timeout = setTimeout(function () {
		debug(topic + ' consumer timed out');

		if (!callback_guard) {
			callback_guard = true;

			consumer.close(true, function(err, data){
				debug(topic + ' consumer closed : ', err, data);
			});

			callback(topic + ' consumer timed out');
		}

	}, 30000);
	consumer_timeout.unref();
	
	consumer.on("message", function (consumer_message) {
		debug(topic + ' : ' + consumerCounter + ' received : ' + consumer_message.value + ' on partition : ' + consumer_message.partition);
		debug(topic + ' : ' + consumerCounter + ' expected : ' + message);

		if (consumer_message.value == message) {
			debug(topic + ' message consumed');
			received |= Math.pow(2, consumer_message.partition);

			debug(topic + ' check status : ' + received + ':' + target_bitmap);

			if (received == target_bitmap) {

				debug(topic + ' all messages received : ' + received + ',' + target_bitmap);

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

						if (consumer_timeout) {
							clearTimeout(consumer_timeout);
						}

						callback(err);
					}
				});
			}
		}
		else {
			debug(topic + ' not my message');
		}
	});

	consumer.on("error", function (err) {
		debug("consumer error : " + topic, err);
		if (!callback_guard) {
			callback_guard = true;

			if (consumer_timeout) {
				clearTimeout(consumer_timeout);
			}

			consumer.close(true, function(err, data){
				debug(topic + ' consumer closed : ', err, data);
			});

			callback(err);
		}
	});
};

