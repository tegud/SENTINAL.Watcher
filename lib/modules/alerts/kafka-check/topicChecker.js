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
	var result = 1;
	var zkConnect;

	/* report result and exit when timeout expires */
	var report_timeout = setTimeout(function () {
		cb(result);
	}, 10000);
	report_timeout.unref();

//'192.168.50.252:2181,192.168.50.252:2182,192.168.50.252:2183';
	async.series([
		function (cb2) {
			async.map(zookeepers, function (item, callback) {
				callback(null, item.host + ':' + item.port);
			}, function (err, result) {
				zkConnect = result.join(',');
				debug("zkConnect", zkConnect);
				cb2(err);
			});
		},
		function (cb2) {
			var timestamp = Date.now();
			var message = 'test ' + timestamp;

			var client = new kafka.Client(zkConnect);
			/*
			client.on("ready", function () {
				debug("ready");
				client.addTopics(['healthcheck'], function (err, added) {
					debug("addTopics", err, added);
				});
			});
			client.on("brokersChanged", function () {
				debug("brokersChanged");
			});
			*/
			//var client2 = new kafka.Client(zkConnect);

			debug('starting', topic, partitions);

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
					debug('finished', err, results);
					if (report_timeout) {
						clearTimeout(report_timeout);
					}
					cb(result);
				}
			);
		}
	]);
}

