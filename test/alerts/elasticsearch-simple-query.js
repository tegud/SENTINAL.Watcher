var expect = require('expect.js');
var async = require('async');
var nock = require('nock');
var moment = require('moment');
var proxyquire = require('proxyquire');
var _ = require('lodash');
var notifiers = require('../../lib/modules/notifiers');
var sources = require('../../lib/modules/sources');
var elasticsearch = require('../../lib/modules/sources/elasticsearch');

var currentDate = '01-01-2014 00:00 Z';

var fakeScheduler = {
	createFromConfig: function(config, task) {
		return {
			start: function() {
				task();
			},
			stop: function() {},
			scheduleNext: function() {}
		};
	}
};

describe('elasticsearch-simple-query', function() {
	describe('queries elasticsearch', function() {
		var elasticsearchSimpleQueryAlert;
		var elasticsearchQueryBuilder;
		var actualRequest;
		var actualIndex;
		var currentDate = '01-01-2014 00:00 Z';

		beforeEach(function() {
			actualRequest = null;
			actualIndex = null;

			var fakeMoment = function() {
				return moment(currentDate, 'DD-MM-YYYY HH:mm Z');
			};

			elasticsearchQueryBuilder = proxyquire('../../lib/modules/sources/elasticsearch/queryBuilder', {
				'moment': fakeMoment,
				'../../../utilities/timeRangeFromNow': proxyquire('../../lib/utilities/timeRangeFromNow', {
					'moment': fakeMoment
				})
			});

			elasticsearchSimpleQueryAlert = proxyquire('../../lib/modules/alerts/elasticsearch-simple-query', {
				'../../modules/schedulers': fakeScheduler,
				'../../modules/sources': {
					getSource: function() {
						return {
							search: function(query) {
								actualRequest = elasticsearchQueryBuilder(query.options);
								actualIndex = query.index;

								return {
									then: function(callback) {
										callback({
											hits: {
												hits: []
											}
										});
									}
								};
							}
						};
					}
				},
				'moment': fakeMoment,
			});
		});

		it('queries today and yesterday\'s logstash indicies', function(done){
			var alert = new elasticsearchSimpleQueryAlert();
			currentDate = '14-05-2014 00:00 Z';
			var expectedIndex = 'logstash-2014.05.14,logstash-2014.05.13';

			async.series([
				async.apply(alert.configure, { query: {} }),
				alert.initialise,
				function(callback) {
					expect(actualIndex).to.be(expectedIndex);
					callback();
				}
			], 
			done);
		});

		it('queries elasticsearch with the configured query', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			async.series([
				async.apply(alert.configure, {
					query: {
						query: 'keyword'
					}
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.query.filtered.query.bool.should[0]['query_string']['query']).to.be('keyword');
					callback();
				}
			], 
			done);
		});

		it('filters elasticsearch query with a timestamp range ending at the current date and time', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			currentDate = '14-05-2014 16:23 Z';

			async.series([
				async.apply(alert.configure, {
					query: {
						time: '10 minutes'
					}
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.query.filtered.filter.bool.must[0].range['@timestamp'].to).to.be(moment(currentDate, 'DD-MM-YYYY HH:mm Z').valueOf());
					callback();
				}
			], 
			done);
		});

		it('filters elasticsearch query with a timestamp range starting at the current date and time', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			currentDate = '14-05-2014 16:23 Z';
			tenMinutesBefore = moment(currentDate, 'DD-MM-YYYY HH:mm Z').subtract('minutes', 10);

			async.series([
				async.apply(alert.configure, {
					query: {
						time: '10 minutes'
					}
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.query.filtered.filter.bool.must[0].range['@timestamp'].from).to.be(tenMinutesBefore.valueOf());
					callback();
				}
			], 
			done);
		});

		it('does not filter elasticsearch query when no time specified', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			async.series([
				async.apply(alert.configure, { query: {} }),
				alert.initialise,
				function(callback) {
					expect(actualRequest.query.filtered.filter).to.be(undefined);
					callback();
				}
			], 
			done);
		});

		it('limits number of results that the elasticsearch query returns to the configured value', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			async.series([
				async.apply(alert.configure, {
					query: {
						numberOfResults: 100
					}
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.size).to.be(100);
					callback();
				}
			], 
			done);
		});
	});

	describe('handles the response from elasticsearch', function() {
		function setElasticsearchResponse(response) {
			nock('http://myelasticsearch.com:9200')
				.filteringPath(/logstash-[0-9]{4}.[0-9]{2}.[0-9]{2}/g, 'logstash-date')
				.post('/logstash-date%2Clogstash-date/_search')
				.reply(200, response);
		}

		function configureAndExecuteAlert(config) {
			var alert = new elasticsearchSimpleQueryAlert();

			async.series([
				async.apply(alert.configure, config),
				alert.initialise
			]);
		}

		var defaultAlertConfig = {
			source: 'elasticsearch',
			query: {},
			mappers: [
				{ 
					"type": "numberOfHits",
					"propertyName": "errors"
				}
			],
			thresholds: [{
				type: 'maxValue',
				limit: 1,
				field: 'errors'
			}]
		};

		beforeEach(function(done) {
			actualRequest = null;

			notifiers.clear();
			sources.clear();

			elasticsearchSimpleQueryAlert = proxyquire('../../lib/modules/alerts/elasticsearch-simple-query', {
				'../../modules/schedulers': fakeScheduler
			});

			var elasticSearchSource = new elasticsearch();

			async.series([
				async.apply(elasticSearchSource.configure, {
					host: 'http://myelasticsearch.com:9200',
					query: {}
				}),
				elasticSearchSource.initialise,
				function(callback) {
					sources.registerSource('elasticsearch', elasticSearchSource);
					callback();
				}
			], done);
		});

		it('notifies of breach event when number of errors returned is over the threshold set', function(done) {
			setElasticsearchResponse({
				hits: {
					hits: [{ '_source': { '@timestamp': 12345 } }, { '_source': { '@timestamp': 12345 } }]
				}
			});

			notifiers.registerNotifier('test', {
				notify: function() {
					done();
				}
			});

			configureAndExecuteAlert(_.extend({}, defaultAlertConfig, {
				notifications: [
					{ "type": "test", "levels": ["breach"] }
				]
			}));
		});

		it('notifies of info event when number of errors returned is not over the threshold set', function(done) {
			setElasticsearchResponse({
				hits: {
					hits: [{ '_source': { '@timestamp': 12345 } }]
				}
			});

			notifiers.registerNotifier('test', {
				notify: function() {
					done();
				}
			});

			configureAndExecuteAlert(_.extend({}, defaultAlertConfig, {
				notifications: [
					{ "type": "test", "levels": ["info"] }
				]
			}));
		});

		it('specifies number of errors when notifing of event', function(done) {
			setElasticsearchResponse({
				hits: {
					hits: [{ '_source': { '@timestamp': 12345 } }, { '_source': { '@timestamp': 12345 } }]
				}
			});

			notifiers.registerNotifier('test', {
				notify: function(event) {
					expect(event.info.errors).to.be(2);
					done();
				}
			});

			configureAndExecuteAlert(_.extend({}, defaultAlertConfig, {
				notifications: [
					{ "type": "test", "levels": ["breach"] }
				]
			}));
		});
	});
});