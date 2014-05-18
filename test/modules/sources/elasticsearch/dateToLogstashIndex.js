var expect = require('expect.js');
var proxyquire = require('proxyquire');
var moment = require('moment');

var currentDate;

var fakeMoment = function() {
	return moment(currentDate, 'DD-MM-YYYY HH:mm Z');
};

var dateToLogstashIndex = proxyquire('../../../../lib/modules/sources/elasticsearch/dateToLogstashIndex', {
	'moment': fakeMoment
});

describe('dateToLogstashIndex', function() {
	it('returns index for today when date text is "today"', function() {
		currentDate = '02-05-2014 11:10 Z';

		expect(dateToLogstashIndex('today')).to.be('logstash-2014.05.02');
	});

	it('returns index for today for UTC when local time date differs', function() {
		currentDate = '02-05-2014 02:00 +03:00';

		expect(dateToLogstashIndex('today')).to.be('logstash-2014.05.01');
	});

	it('returns index for yesterday when date text is "yesterday"', function() {
		currentDate = '02-05-2014 11:10 Z';

		expect(dateToLogstashIndex('yesterday')).to.be('logstash-2014.05.01');
	});

	it('returns index for today and yesterday when date text is "today,yesterday"', function() {
		currentDate = '02-05-2014 11:10 Z';

		expect(dateToLogstashIndex('today,yesterday')).to.be('logstash-2014.05.02,logstash-2014.05.01');
	});

	it('returns index for specified date when date text is "2014.06.01"', function() {
		expect(dateToLogstashIndex('2014.06.01')).to.be('logstash-2014.06.01');
	});
});
