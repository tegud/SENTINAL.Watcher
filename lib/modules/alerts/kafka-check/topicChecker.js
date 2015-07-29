/* states
	1: health check initiated
	2: message produced
	3: message consumed

statsd metric example:
	kafka.rateplans.health:3|g
*/

var kafka = require('kafka-node'),
    async = require('async'),
    debug = require('debug')('sentinel:alerts:kafka-check:topicChecker'),

    producer = require('./producer'),
    consumer = require('./consumer');

module.exports = function (zookeepers, topic, partitions, cb) {
	var client,
		callback_guard;

	var result = 1;

	/* report result and exit when timeout expires */
	var report_timeout = setTimeout(function () {
		debug('time out for topic check : ' + topic);

		if (!callback_guard) {
			callback_guard = true;
			cb(result);
		}

	}, 50000);
	report_timeout.unref();

	var currentdate = new Date(); 
	var timestamp = currentdate.getDate() + "-"
        + (currentdate.getMonth()+1)  + "-" 
        + currentdate.getFullYear() + " "  
        + currentdate.getHours() + ":"  
        + currentdate.getMinutes() + ":" 
        + currentdate.getSeconds();

	async.series([
		function (callback) {
			client = new kafka.Client(zookeepers);
			client.on('ready', callback);
		},
		function (cb2) {

			var message = topic + ' : ' + timestamp;

			debug('starting topic check : ' + topic, topic, partitions);

			async.parallel([
					function (callback) {
						consumer(client, topic, partitions, message, function (err) {
							if (!err) {
								result = 3;
							}
							callback(err);
						});
					},
					function (callback) {
						producer(client, topic, partitions, message, function (err) {
							if (!err) {
								result = 2;
							}
							callback(err);
						});
					}
				], function (err, results) {
					debug(topic + ' check finished : ', err, results);

					if (report_timeout) {
						clearTimeout(report_timeout);
					}

					if (!callback_guard) {
						callback_guard = true;
						debug(topic + ' topic checker result : ' + result);
						cb(result);
					}
				}
			);
		}
	]);
}

