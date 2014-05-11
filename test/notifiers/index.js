var expect = require('expect.js');
var events = require('../../lib/events');
var notifiers = require('../../lib/modules/notifiers');

describe('notifiers', function() {
	beforeEach(function() {
		events.removeAllListeners();
	});

	describe('registerAlertNotifications', function() {
		describe('event type', function() {
			it('Sends notification when matching event type is received.', function() {
				var notifyCalled = false;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled = true;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['all'] }]);

				events.emit('elasticsearch-lag', {});

				expect(notifyCalled).to.be(true);
			});

			it('Does not send notification when a different event type is received', function() {
				var notifyCalled = false;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled = true;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['all'] }]);

				events.emit('wrong-event');

				expect(notifyCalled).to.be(false);
			});
		});

		describe('event level', function() {
			it('sends notification when configured to listen for event with specified level.', function() {
				var notifyCalled = false;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled = true;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				events.emit('elasticsearch-lag', { event: { level: 'breach'  } });

				expect(notifyCalled).to.be(true);
			});

			it('sends notification when configured to listen for all levels.', function() {
				var notifyCalled = false;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled = true;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['all'] }]);

				events.emit('elasticsearch-lag',{ event: { level: 'breach' } });

				expect(notifyCalled).to.be(true);
			});

			it('does not send notification for event with specified level not configured.', function() {
				var notifyCalled = false;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled = true;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				events.emit('elasticsearch-lag', { event: { level: 'info' } });

				expect(notifyCalled).to.be(false);
			});
		});

		describe('event notificationConfig', function() {
			it('is filtered to the relevent notifier type', function() {
				var actualNotificationConfig;
				var expectedNotificationConfig = { type: 'test1', abcd: 1234 };

				notifiers.registerNotifier('test1', { 
					notify: function(event, notifierConfig) {
						actualNotificationConfig = notifierConfig;
					} 
				});

				notifiers.registerNotifier('test2', { 
					notify: function() { } 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [
					{ type: 'test1', levels: ['all'] },
					{ type: 'test2', levels: ['all'] }
					]);

				events.emit('elasticsearch-lag', { 
					event: { level: 'info' },
					notifierConfig: [expectedNotificationConfig, { type: 'test2', abcd: 1234 }] 
				});

				expect(actualNotificationConfig).to.be(expectedNotificationConfig);
			});

			it('handles the event not having relevent notifierConfig', function() {
				var actualNotificationConfig;
				var expectedNotificationConfig = undefined;

				notifiers.registerNotifier('test1', { 
					notify: function(event, notifierConfig) {
						actualNotificationConfig = notifierConfig;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [ { type: 'test1', levels: ['all'] } ]);

				events.emit('elasticsearch-lag', { 
					event: { level: 'info' },
					notifierConfig: [{ type: 'test2', abcd: 1234 }] 
				});

				expect(actualNotificationConfig).to.be(undefined);
			});
		});
	});
});
