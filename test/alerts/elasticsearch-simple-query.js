var expect = require('expect.js');
var async = require('async');
var nock = require('nock');
var moment = require('moment');
var proxyquire = require('proxyquire');
var moment = require('moment');

var currentDate = '01-01-2014';

describe('elasticsearch-errors', function() {
	var elasticsearchSimpleQueryAlert;
	var actualRequest;

	beforeEach(function() {
		actualRequest = null;
		elasticsearchSimpleQueryAlert = proxyquire('../../lib/modules/alerts/elasticsearch-simple-query', {
			'../../modules/schedulers': {
				createFromConfig: function(config, task) {
					return {
						start: function() {
							task();
						},
						stop: function() {},
						scheduleNext: function() {}
					};
				}
			},
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
				return moment(currentDate, 'DD-MM-YYYY');
			}
		});
	});

	it('queries today and yesterday\'s logstash indicies', function(done){
		currentDate = '14-05-2014';
		var expectedIndex = 'logstash-2014.05.14,logstash-2014.05.13';

		async.series([
			async.apply(elasticsearchSimpleQueryAlert.configure, { }),
			elasticsearchSimpleQueryAlert.initialise,
			function(callback) {
				expect(actualRequest.index).to.be(expectedIndex);
				callback();
			}
		], 
		done);
	});

	it('queries elastic search with the configured query', function(done) {
		async.series([
			async.apply(elasticsearchSimpleQueryAlert.configure, {
				query: 'keyword'
			}),
			elasticsearchSimpleQueryAlert.initialise,
			function(callback) {
				expect(actualRequest.body.query.filtered.query.bool.should[0]['query_string']['query']).to.be('keyword');
				callback();
			}
		], 
		done);
	});

	it('filters elastic search query with a timestamp range ending at the current date and time', function(done) {
		async.series([
			async.apply(elasticsearchSimpleQueryAlert.configure, { }),
			elasticsearchSimpleQueryAlert.initialise,
			function(callback) {
				expect(actualRequest.body.query.filtered.filter.bool.must[0].range['@timestamp'].to).to.be(123456789);
				callback();
			}
		], 
		done);
	});
});
		// nock('http://myelasticsearch.com:9200')
		// 	.filteringPath(/logstash-[0-9]{4}.[0-9]{2}.[0-9]{2}/g, 'logstash-date')
		// 	.post('/logstash-date%2Clogstash-date/_search')
		// 	.reply(200, {
		// 		abcde: 1234
		// 	});