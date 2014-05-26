var proxyquire = require('proxyquire');
var expect = require('expect.js');
var moment = require('moment');

var kibanaLinkFactory = proxyquire('../../../lib/modules/eventBuilders/kibanaLink', {});

describe('kibanaLink', function() {
	it('appends kibanaLink to the eventInfo', function(done) {
		var expectedUrl = 'http://mykibana.domain.com/test';
		var kibanaLinkBuilder = kibanaLinkFactory({ baseLink: expectedUrl });

		kibanaLinkBuilder({ info: {} }, function(err, event) {
			expect(event.info.kibanaLink).to.be(expectedUrl);
			done();
		});
	});

	it('sets the querystring from parameter to specified value', function(done) {
		var expectedUrl = 'http://mykibana.domain.com/test?from=now-1h';
		var kibanaLinkBuilder = kibanaLinkFactory({ 
			baseLink: 'http://mykibana.domain.com/test',
			from: 'now-1h' 
		});

		kibanaLinkBuilder({ info: {} }, function(err, event) {
			expect(event.info.kibanaLink).to.be(expectedUrl);
			done();
		});
	});

	it('sets the querystring from parameter with a & when baseLink contains querystring', function(done) {
		var expectedUrl = 'http://mykibana.domain.com/test?query=xyz&from=now-1h';
		var kibanaLinkBuilder = kibanaLinkFactory({ 
			baseLink: 'http://mykibana.domain.com/test?query=xyz',
			from: 'now-1h' 
		});

		kibanaLinkBuilder({ info: {} }, function(err, event) {
			expect(event.info.kibanaLink).to.be(expectedUrl);
			done();
		});
	});

	describe('event relative datetimes', function(done) {
		it('sets from parameter to the eventRaised datetime minus the specified period', function(done) {
			var expectedUrl = 'http://mykibana.domain.com/test?from=2014-05-01 20:40:00+00:00';
			var eventRaised = moment('2014-05-01 21:00:00+00:00', 'YYYY-MM-DD HH:mm:ssZ');
			var kibanaLinkBuilder = kibanaLinkFactory({ 
				baseLink: 'http://mykibana.domain.com/test',
				from: 'event-20m' 
			});

			kibanaLinkBuilder({
				raised: eventRaised,
				info: {}
			}, function(err, event) {
				expect(event.info.kibanaLink).to.be(expectedUrl);
				done();
			});
		});

		it('sets to parameter to the eventRaised datetime plus the specified period', function(done) {
			var expectedUrl = 'http://mykibana.domain.com/test?to=2014-05-01 21:20:00+00:00';
			var eventRaised = moment('2014-05-01 21:00:00+00:00', 'YYYY-MM-DD HH:mm:ssZ');
			var kibanaLinkBuilder = kibanaLinkFactory({ 
				baseLink: 'http://mykibana.domain.com/test',
				to: 'event+20m' 
			});

			kibanaLinkBuilder({
				raised: eventRaised,
				info: {}
			}, function(err, event) {
				expect(event.info.kibanaLink).to.be(expectedUrl);
				done();
			});
		});
	});
});
