var expect = require('expect.js');
var async = require('async');
var nock = require('nock');
var moment = require('moment');
var proxyquire = require('proxyquire');
var moment = require('moment');
var notifiers = require('../../lib/modules/notifiers');

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

describe('elasticsearch-errors', function() {
	describe('queries elasticsearch', function() {
		var elasticsearchSimpleQueryAlert;
		var actualRequest;
		var currentDate = '01-01-2014 00:00 Z';

		beforeEach(function() {
			actualRequest = null;
			elasticsearchSimpleQueryAlert = proxyquire('../../lib/modules/alerts/elasticsearch-simple-query', {
				'../../modules/schedulers': fakeScheduler,
				'elasticsearch': {
					Client: function() {
						return {
							search: function(request) {
								actualRequest = request;

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
				'moment': function() {
					return moment(currentDate, 'DD-MM-YYYY HH:mm Z');
				}
			});
		});

		it('queries today and yesterday\'s logstash indicies', function(done){
			var alert = new elasticsearchSimpleQueryAlert();
			currentDate = '14-05-2014 00:00 Z';
			var expectedIndex = 'logstash-2014.05.14,logstash-2014.05.13';

			async.series([
				async.apply(alert.configure, { }),
				alert.initialise,
				function(callback) {
					expect(actualRequest.index).to.be(expectedIndex);
					callback();
				}
			], 
			done);
		});

		it('queries elasticsearch with the configured query', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			async.series([
				async.apply(alert.configure, {
					query: 'keyword'
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.body.query.filtered.query.bool.should[0]['query_string']['query']).to.be('keyword');
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
					time: '10 minutes'
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.body.query.filtered.filter.bool.must[0].range['@timestamp'].to).to.be(moment(currentDate, 'DD-MM-YYYY HH:mm Z').valueOf());
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
					time: '10 minutes'
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.body.query.filtered.filter.bool.must[0].range['@timestamp'].from).to.be(tenMinutesBefore.valueOf());
					callback();
				}
			], 
			done);
		});

		it('does not filter elasticsearch query when no time specified', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			async.series([
				async.apply(alert.configure, { }),
				alert.initialise,
				function(callback) {
					expect(actualRequest.body.query.filtered.filter).to.be(undefined);
					callback();
				}
			], 
			done);
		});

		it('limits number of results that the elasticsearch query returns to the configured value', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			async.series([
				async.apply(alert.configure, {
					limitResultsTo: 100
				}),
				alert.initialise,
				function(callback) {
					expect(actualRequest.body.size).to.be(100);
					callback();
				}
			], 
			done);
		});
	});

	describe('handles the response from elasticsearch', function() {
		beforeEach(function() {
			actualRequest = null;

			notifiers.clear();

			elasticsearchSimpleQueryAlert = proxyquire('../../lib/modules/alerts/elasticsearch-simple-query', {
				'../../modules/schedulers': fakeScheduler
			});
		});

		it('notifies of breach event when number of errors returned is over the threshold set', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();

			nock('http://myelasticsearch.com:9200')
				.filteringPath(/logstash-[0-9]{4}.[0-9]{2}.[0-9]{2}/g, 'logstash-date')
				.post('/logstash-date%2Clogstash-date/_search')
				.reply(200, {
					hits: {
						hits: [{ '_source': { '@timestamp': 12345 } }, { '_source': { '@timestamp': 12345 } }]
					}
				});

			notifiers.registerNotifier('test', {
				notify: function() {
					done();
				}
			});

			async.series([
				async.apply(alert.configure, {
					host: 'http://myelasticsearch.com:9200',
					limit: 1,
					notifications: [
						{ "type": "test", "levels": ["breach"] }
					]
				}),
				alert.initialise
			]);
		});

		it('notifies of info event when number of errors returned is not over the threshold set', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();

			nock('http://myelasticsearch.com:9200')
				.filteringPath(/logstash-[0-9]{4}.[0-9]{2}.[0-9]{2}/g, 'logstash-date')
				.post('/logstash-date%2Clogstash-date/_search')
				.reply(200, {
					hits: {
						hits: [{ '_source': { '@timestamp': 12345 } }]
					}
				});

			notifiers.registerNotifier('test', {
				notify: function() {
					done();
				}
			});

			async.series([
				async.apply(alert.configure, {
					host: 'http://myelasticsearch.com:9200',
					limit: 1,
					notifications: [
						{ "type": "test", "levels": ["info"] }
					]
				}),
				alert.initialise
			]);
		});

		it('specifies number of errors when notifing of event', function(done) {
			var alert = new elasticsearchSimpleQueryAlert();
			
			nock('http://myelasticsearch.com:9200')
				.filteringPath(/logstash-[0-9]{4}.[0-9]{2}.[0-9]{2}/g, 'logstash-date')
				.post('/logstash-date%2Clogstash-date/_search')
				.reply(200, {
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

			async.series([
				async.apply(alert.configure, {
					host: 'http://myelasticsearch.com:9200',
					limit: 1,
					notifications: [
						{ "type": "test", "levels": ["breach"] }
					]
				}),
				alert.initialise
			]);
		});
	});
});