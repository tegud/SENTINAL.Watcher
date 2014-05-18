var expect = require('expect.js');
var proxyquire = require('proxyquire');
var moment = require('moment');

var currentDate;

var fakeMoment = function() {
	return moment(currentDate, 'DD-MM-YYYY HH:mm Z');
};

var logstash = proxyquire('../../../lib/utilities/logstash', {
	'moment': fakeMoment
});

describe('logstash', function() {
	describe('dateToIndex', function() {
		it('returns index for today when date text is "today"', function() {
			currentDate = '02-05-2014 11:10 Z';

			expect(logstash.dateToIndex('today')).to.be('logstash-2014.05.02');
		});

		it('returns index for today for UTC when local time date differs', function() {
			currentDate = '02-05-2014 02:00 +03:00';

			expect(logstash.dateToIndex('today')).to.be('logstash-2014.05.01');
		});

		it('returns index for yesterday when date text is "yesterday"', function() {
			currentDate = '02-05-2014 11:10 Z';

			expect(logstash.dateToIndex('yesterday')).to.be('logstash-2014.05.01');
		});

		it('returns index for today and yesterday when date text is "today,yesterday"', function() {
			currentDate = '02-05-2014 11:10 Z';

			expect(logstash.dateToIndex('today,yesterday')).to.be('logstash-2014.05.02,logstash-2014.05.01');
		});

		it('returns index for specified date when date text is "2014.06.01"', function() {
			expect(logstash.dateToIndex('2014.06.01')).to.be('logstash-2014.06.01');
		});
	});
});
