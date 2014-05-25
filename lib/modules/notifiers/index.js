var _ = require('lodash');
var moment = require('moment');

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

		events.on(eventName, function(eventInfo) {
			var matchingNotifiers = filterNotificationsByLevel(notifications, eventInfo.event.level);

			_.each(matchingNotifiers, function(notification) {
				var type = notification.type;
				var levels = notification.levels;
				var includeAllLevels = _.contains(levels, 'all');

				var eventIdentifier = eventName + '.' + eventInfo.event.level;

				if(!includeAllLevels && (!eventInfo.event.level || !_.contains(levels, eventInfo.event.level))) {
					return;
				}

				if(notification.limitTo && notification.limitTo.onceEvery) {
					var withinDebouncePeriod = false;
					var msLimit = notification.limitTo.onceEvery;
					var timeRegex = /^([0-9]+) ([a-z]+)$/i;

					if(typeof msLimit === 'string') {
						var timeMatch = msLimit.match(timeRegex);
						if(timeMatch && timeMatch.length > 2) {
							msLimit = moment.duration(parseInt(timeMatch[1], 10), timeMatch[2]).asMilliseconds();
						}
					}

					if(notifierDebounce[eventIdentifier] 
						&& moment().diff(notifierDebounce[eventIdentifier], 'ms') < msLimit) {
						withinDebouncePeriod = true;
					}

					if(!withinDebouncePeriod) {
						notifierDebounce[eventIdentifier] = moment();
					}
					else {
						return;
					}
				}

				notifiers[type].notify(eventInfo.event, notification);
			});
		});
	}
};
