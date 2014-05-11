var _ = require('lodash');
var events = require('../../events');
var notifiers = {
	'email': require('./email'),
	'console': require('./console')
};

module.exports = {
	registerNotifier: function(name, notifier) {
		notifiers[name] = notifier;
	},
	registerAlertNotifications: function(eventName, notifications) {
		_.each(notifications, function(notification) {
			var type = notification.type;
			var levels = notification.levels;
			var includeAllLevels = _.contains(levels, 'all');

			events.on(eventName, function(eventInfo) {
				eventInfo = _.clone(eventInfo);
				if(!includeAllLevels && (!eventInfo.event.level || !_.contains(levels, eventInfo.event.level))) {
					return;
				}

				eventInfo.notifierConfig = _.first(_.filter(eventInfo.notifierConfig, function(config) {
					return type === config.type;
				}));

				notifiers[type].notify(eventInfo);
			});
		});
	}
};
