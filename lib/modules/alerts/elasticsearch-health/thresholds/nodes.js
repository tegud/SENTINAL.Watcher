var _ = require('lodash');

var Levels = (function() {
	var levels = ['info', 'breach', 'critical'];

	return {
		highest: function(breachLevels) {
			var sortedLevels = _.sortBy(breachLevels.slice(0), function(level) {
				return _.indexOf(levels, level);
			});

			return _.last(sortedLevels);
		}
	};
})();

module.exports = function(recorder, config) {
	var stats = _.map(config.stats, function(stat) {
		return {
			stat: stat.stat,
			thresholds: _.map(stat.thresholds, function(threshold) { 
				threshold.field = stat.stat;

				return new require('../../../thresholds/' + threshold.type)(recorder, threshold);
			})
		}
	});

	return {
		checkValue: function() {
			var thresholdBreached = false;
			var result = recorder.getLastResult();

			var nodeBreaches = _.chain(result.nodes).map(function(node) {
				var breaches = _.chain(stats).map(function(stat) {
						var breach = _.chain(stat.thresholds).map(function(threshold) {
							return threshold.checkValue(node.stats);
						}).filter(function(breach) {
							return breach.breached;
						}).first().value();

						if(breach) {
							return {
								stat: stat.stat,
								breach: breach
							};
						}
					}).filter(function(breaches) { return breaches }).value();

				return {
					name: node.name,
					breaches: breaches,
					breached: breaches.length ? true : false,
					level: Levels.highest(_.map(breaches, function(stat) {
						return stat.breach.level;
					}))
				};
			}).filter(function(node) { return node.breached; }).value();

			return {
				type: 'nodes',
				nodes: nodeBreaches,
				breached: nodeBreaches.length ? true : false,
				level: Levels.highest(_.pluck(nodeBreaches, 'level'))
			};
		}
	};
};
