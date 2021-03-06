var expect = require('expect.js');
var proxyquire = require('proxyquire');
var moment = require('moment');

var events = require('../../../lib/events');
var notifiers;
var currentDate;

describe('notifiers', function() {
	beforeEach(function() {
		 notifiers = proxyquire('../../../lib/modules/notifiers', {
			'./throttlers': proxyquire('../../../lib/modules/notifiers/throttler', {
				'moment': function() {
					return moment(currentDate, 'DD-MM-YYYY HH:mm Z');
				}
			})
		});
		events.removeAllListeners();
	});

	describe('registerAlertNotifications', function() {
		describe('event type', function() {
			it('Sends notification when matching event type is received.', function() {
				var notifyCalled = false;
                var savedEventName, savedEvent;

				notifiers.registerNotifier('test', { 
					notify: function(eventName, event) {
                        savedEventName = eventName;
                        savedEvent = event;
						notifyCalled = true;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['all'] }]);

                var exampleEventName = 'elasticsearch-lag';
                var exampleEvent = { eventInfo: "goes here"};
                events.emit(exampleEventName, exampleEvent);

                expect(notifyCalled).to.be(true);
                expect(savedEventName).to.be(exampleEventName);
                expect(savedEvent).to.be(exampleEvent);
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
					notify: function(eventName, event, notifierConfig) {
						level = notifierConfig.levels[0];
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['critical'] }]);
				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				events.emit('elasticsearch-lag', { level: 'breach' });

				expect(level).to.be('breach');
			});

			it('Executes multiple notifiers of the same type', function() {
				var notifyCalled = 0;

				notifiers.registerNotifier('test', { 
					notify: function(eventName, event, notifierConfig) {
						notifyCalled += notifierConfig.a;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'], a: 2 }]);
				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'], a: 1 }]);

				events.emit('elasticsearch-lag', { level: 'breach' });

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

				events.emit('elasticsearch-lag', { level: 'breach'  });

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

				events.emit('elasticsearch-lag', { level: 'breach' });

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

				events.emit('elasticsearch-lag', { level: 'info' });

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

				notifiers.registerAlertNotifications('elasticsearch-lag', notifierConfig);

				events.emit('elasticsearch-lag', { level: 'breach' });

				events.emit('elasticsearch-lag', { level: 'breach' });

				expect(notifyCalled).to.be(1);
			});

			it('does not send multiple notifications during the time specified by text', function() {
				var notifyCalled = 0;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled++;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', 
					[{ type: 'test', levels: ['all'], limitTo: { onceEvery: '10 minutes' } }]);

				currentDate = '01-01-2014 00:00 Z';
				
				events.emit('elasticsearch-lag', { level: 'breach' });

				events.emit('elasticsearch-lag', { level: 'breach' });

				expect(notifyCalled).to.be(1);
			});

			it('does sends multiple notifications once the time specified has elapsed', function() {
				var notifyCalled = 0;

				notifiers.registerNotifier('test', { 
					notify: function() {
						notifyCalled++;
					} 
				});

				notifiers.registerAlertNotifications('elasticsearch-lag', [{ type: 'test', levels: ['breach'] }]);

				currentDate = '01-01-2014 00:00 Z';

				events.emit('elasticsearch-lag', { level: 'breach' });

				currentDate = '01-01-2014 00:11 Z';

				events.emit('elasticsearch-lag', { level: 'breach' });

				expect(notifyCalled).to.be(2);
			});
		});
	});
});
