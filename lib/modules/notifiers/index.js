var _ = require('lodash');
var moment = require('moment');

var events = require('../../events');
var config = require('../../config');
var notifiers = config.getConfiguredModulesForType('notifiers');
var stringToDuration = require('../../utilities/stringToDuration');

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

		events.on(eventName, function(eventInfo) {
			var matchingNotifiers = filterNotificationsByLevel(notifications, eventInfo.event.level);

			_.each(matchingNotifiers, function(notification) {
				var eventIdentifier = eventName + '.' + eventInfo.event.level;

				if(notification.limitTo && notification.limitTo.onceEvery) {
					var withinDebouncePeriod = false;
					var msLimit = notification.limitTo.onceEvery;
					var now = moment();

					if(typeof msLimit === 'string') {
						msLimit = stringToDuration(msLimit).asMilliseconds();
					}

					if(notifierDebounce[eventIdentifier] 
						&& now.diff(notifierDebounce[eventIdentifier], 'ms') < msLimit) {
						withinDebouncePeriod = true;
					}

					if(!withinDebouncePeriod) {
						notifierDebounce[eventIdentifier] = now;
					}
					else {
						return;
					}
				}

				notifiers[notification.type].notify(eventInfo.event, notification);
			});
		});
	}
};
