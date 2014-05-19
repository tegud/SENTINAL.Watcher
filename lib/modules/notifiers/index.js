var _ = require('lodash');
var moment = require('moment');

var events = require('../../events');
var config = require('../../config');
var notifiers = config.getConfiguredModulesForType('notifiers');

var notifierDebounce = {};

module.exports = {
	registerNotifier: function(name, notifier) {
		notifiers[name] = notifier;
	},
	clear: function() {
		notifiers = {};
		events.removeAllListeners();
	},
	registerAlertNotifications: function(eventName, notifications) {
		_.each(notifications, function(notification) {
			var type = notification.type;
			var levels = notification.levels;
			var includeAllLevels = _.contains(levels, 'all');

			events.on(eventName, function(eventInfo) {
				var eventIdentifier = eventName + '.' + eventInfo.event.level;

				if(!includeAllLevels && (!eventInfo.event.level || !_.contains(levels, eventInfo.event.level))) {
					return;
				}

				var notifierConfig = _.first(_.filter(eventInfo.notifierConfig, function(config) {
					return type === config.type;
				}));

				if(eventInfo.notifierConfig && eventInfo.notifierConfig.limitTo && eventInfo.notifierConfig.limitTo.onceEvery) {
					var withinDebouncePeriod = false;
					
					if(notifierDebounce[eventIdentifier] 
						&& moment().diff(notifierDebounce[eventIdentifier], 'ms') < eventInfo.notifierConfig.limitTo.onceEvery) {
						withinDebouncePeriod = true;
					}

					if(!withinDebouncePeriod) {
						notifierDebounce[eventIdentifier] = moment();
					}
					else {
						return;
					}
				}

				notifiers[type].notify(eventInfo.event, notifierConfig);
			});
		});
	}
};
