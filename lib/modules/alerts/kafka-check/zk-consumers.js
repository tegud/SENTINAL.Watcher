var events = require('events'),
    debug = require('debug')('sentinel:alerts:kafka-check:zk-consumers'),
    async = require('async'),
    _ = require('lodash'),
    zookeeper = require('node-zookeeper-client');

function watchChildren(client, node, _data) {
	var children;
	var ev = new events.EventEmitter();
	var fn = _data ? 'getData' : 'getChildren';

	function change(event) {
		watch();
	}

	function childAdded(child) {
		ev.emit("added", child);
	}

	function childRemoved(child) {
		ev.emit("removed", child);
	}

	function dataChanged(newData) {
		ev.emit("changed", newData);
	}

	function watch() {
		async.series([
			function (cb) {
				client[fn](node, change, cb);
			}], function (err, data, stat) {
				if (err) {
					if (err.getCode() == zookeeper.Exception.NO_NODE) {
						// parent has been removed
						ev.emit("end");
						return;
					} else {
						// unanticipated
						debug('error', err);
						return;
					}
				}

				if (typeof data === 'object' && typeof data[0] === 'object') {
					if (_data) {
						dataChanged(data[0][0].toString('ascii'));
					} else {
						var currentChildren = data[0][0],
						    added = _.difference(currentChildren, children),
						    removed = _.difference(children, currentChildren);

						async.forEachOf(added, childAdded);
						async.forEachOf(removed, childRemoved);
						
						children = currentChildren;
					}
				}
			}
		);
	}

	watch();

	return {
		on: ev.on.bind(ev)
	};
}

function watchData(client, node) {
	return watchChildren(client, node, true);
}

function monitor(client) {
	function consumer(consumer_name) {
		var ev = new events.EventEmitter();

		var topics = {};

		function watch() {
			var consumer_data = watchChildren(client, '/consumers/' + consumer_name);
			consumer_data.on('added', function (item) {
				if (item === 'offsets') {
					var topic_offsets = watchChildren(client, '/consumers/' + consumer_name + '/' + item);
					topic_offsets.on('added', function (topic_name) {
						var t = topic(consumer_name, topic_name);
						topics[topic_name] = t;
						ev.emit('topic', t);
					});

					topic_offsets.on('removed', function (topic_name) {
						debug('topic ' + topic_name + ' removed');
						topics[topic_name].end();
						delete topics[topic_name];
					});
				}
			});
		}

		return {
			on: ev.on.bind(ev),
			watch: watch,
			getName: function () {return consumer_name},
			end: function () { ev.emit('end'); }
		};
	}

	function topic(consumer_name, topic_name) {
		var ev = new events.EventEmitter();

		function watch() {
			var partitions = watchChildren(client, '/consumers/' + consumer_name + '/offsets/' + topic_name);
			partitions.on('added', function (partition_id) {
				var data = watchData(client, '/consumers/' + consumer_name + '/offsets/' + topic_name + '/' + partition_id);
				data.on('changed', function (newData) {
					ev.emit('offset', {partition: partition_id, offset: newData});
				});

			});
		}

		function end() {
			ev.emit('end');
		}

		return {
			on: ev.on.bind(ev),
			watch: watch,
			getName: function () {return topic_name},
			end: function () { ev.emit('end'); }
		};
	}

	var c = {};

	var ev = new events.EventEmitter();
	var consumers = watchChildren(client, '/consumers');
	consumers.on('added', function (consumer_name) {
		var cons = consumer(consumer_name);
		c[consumer_name] = cons;
		ev.emit('consumer', cons);
	});
	consumers.on('removed', function (consumer_name) {
		c[consumer_name].end();
	});

	return {
		on: ev.on.bind(ev)
	};
}

module.exports = monitor;

