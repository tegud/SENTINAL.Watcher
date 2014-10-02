var _ = require('lodash');

var throttler = require('./throttler');
var events = require('../../events');
var config = require('../../config');
var notifiers = config.getConfiguredModulesForType('notifiers');

var notifierDebounce = {};

function filterNotificationsByLevel(notifications, level) {
	return _.filter(notifications, function(config) {
		return (_.contains(config.levels, 'all') || _.contains(config.levels, level));
	});
}

module.exports = {
	registerNotifier: function(name, notifier) {
		notifiers[name] = notifier;
	},
	clear: function() {
		notifiers = {};
		notifierDebounce = {};
		events.removeAllListeners();
	},
	registerAlertNotifications: function(eventName, notifications) {
		var notifierConfig = notifications;

		events.on(eventName, function(event) {
			var matchingNotifiers = filterNotificationsByLevel(notifications, event.level);

			_.each(matchingNotifiers, function(notification) {
				var eventIdentifier = eventName + '.' + event.level + '.' + notification.type;
				var task = notifiers[notification.type].notify.bind(undefined, eventName, event, notification);

				if(!notifierDebounce[eventIdentifier]) {
					notifierDebounce[eventIdentifier] = throttler(notification.limitTo);					
				}

				notifierDebounce[eventIdentifier](task);
			});
		});
	}
};
