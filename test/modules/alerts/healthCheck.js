var expect = require('expect.js');
var async = require('async');
var proxyquire = require('proxyquire');

var sources = require('../../../lib/modules/sources');
var notifiers = require('../../../lib/modules/notifiers');
var healthChecker = require('../../../lib/modules/sources/healthChecker');
var healthCheck;

var fakeScheduler = {
	createFromConfig: function(config, task) {
		return {
			start: function() {
				task();
			},
			stop: function() {},
			scheduleNext: function() {}
		};
	}
};

describe('healthCheck', function() {
	beforeEach(function(done) {
		notifiers.clear();
		sources.clear();

		healthCheck = proxyquire('../../../lib/modules/alerts/healthCheck', {
			'../../modules/schedulers': fakeScheduler
		});

		var source = new healthChecker();

		async.series([
			async.apply(source.configure, {
				"servers": [
					{}
				],
				"healthCheckers": {
					"test": {
						
					}
				}
			}),
			source.initialise,
			function(callback) {
				sources.registerSource('healthChecker', source);
				callback();
			}
		], done);
	});

	describe('returns status of configured server', function() {
		it.only('returns OK status when server is responding as expected', function(done) {
			var alert = new healthCheck();

			notifiers.registerNotifier('test', {
				notify: function(event) {
					done();
				}
			});

			async.series([
				async.apply(alert.configure, {
					source: 'healthChecker',
					notifications: [
						{ "type": "test", "levels": ["info"] }
					]
				}),
				alert.initialise
			]);
		});
	});
});