var expect = require('expect.js');
var events = require('../../lib/events');
var notifiers = require('../../lib/notifiers');

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

				events.emit('elasticsearch-lag');

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

				events.emit('elasticsearch-lag', { level: 'breach' });

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
		});
	});
});
