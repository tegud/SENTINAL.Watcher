var expect = require('expect.js');
var proxyquire = require('proxyquire');
var moment = require('moment');

var events = require('../../../lib/events');
var notifiers;
var currentDate;

describe('notifiers', function() {
	beforeEach(function() {
		 notifiers = proxyquire('../../../lib/modules/notifiers', {
			'moment': function() {
				return moment(currentDate, 'DD-MM-YYYY HH:mm Z');
			}
		});
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

				events.emit('elasticsearch-lag', { event: {} });

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

			it('Chooses the correct notification for multiples of the same type with different levels', function() {
				var level;

				notifiers.registerNotifier('test', { 
					notify: function(event, notifierConfig) {
						level = notifierConfig.levels[0];
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['critical'] }]);
				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				events.emit('elasticsearch-lag', { 
					event: { level: 'breach' }, 
					notifierConfig: [
						{ type: 'test', levels: ['critical'], abcd: 1 }, 
						{ type: 'test', levels: ['breach'], abcd: 2 }
					] 
				});

				expect(level).to.be('breach');
			});

			it.skip('Executes multiple notifiers of the same type', function() {
				var notifyCalled = 0;

				notifiers.registerNotifier('test', { 
					notify: function(event, notifierConfig) {
						console.log(notifierConfig);
						notifyCalled += notifierConfig.a;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);
				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				events.emit('elasticsearch-lag', { 
					event: { level: 'breach' }, 
					notifierConfig: [
						{ type: 'test', levels: ['breach'], a: 2 }, 
						{ type: 'test', levels: ['breach'], a: 1 }
					] 
				});

				expect(notifyCalled).to.be(3);
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

			it('does not send multiple notifications during the time specified', function() {
				var notifyCalled = 0;
				var notifierConfig = [{ type: 'test', levels: ['all'], limitTo: { onceEvery: 600000 } }];

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled++;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				events.emit('elasticsearch-lag', { event: { level: 'breach' }, notifierConfig: notifierConfig });

				events.emit('elasticsearch-lag', { event: { level: 'breach' }, notifierConfig: notifierConfig });

				expect(notifyCalled).to.be(1);
			});

			it('does not send multiple notifications during the time specified by text', function() {
				var notifyCalled = 0;
				var notifierConfig = [{ type: 'test', levels: ['all'], limitTo: { onceEvery: '10 minutes' } }];

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled++;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				currentDate = '01-01-2014 00:00 Z';
				
				events.emit('elasticsearch-lag', { event: { level: 'breach' }, notifierConfig: notifierConfig });

				events.emit('elasticsearch-lag', { event: { level: 'breach' }, notifierConfig: notifierConfig });

				expect(notifyCalled).to.be(1);
			});

			it('does sends multiple notifications once the time specified has elapsed', function() {
				var notifyCalled = 0;
				var notifierConfig = [{ type: 'test', levels: ['all'], limitTo: { onceEvery: 600000 } }];

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled++;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				currentDate = '01-01-2014 00:00 Z';

				events.emit('elasticsearch-lag', { event: { level: 'breach' }, notifierConfig: notifierConfig });

				currentDate = '01-01-2014 00:11 Z';

				events.emit('elasticsearch-lag', { event: { level: 'breach' }, notifierConfig: notifierConfig });

				expect(notifyCalled).to.be(2);
			});
		});

		describe('event notificationConfig', function() {
			it('is filtered to the relevent notifier type', function() {
				var actualNotificationConfig;
				var expectedNotificationConfig = { type: 'test1', levels: ['all'], abcd: 1234 };

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
					notifierConfig: [expectedNotificationConfig, { type: 'test2', levels: ['all'], abcd: 1234 }] 
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
