var expect = require('expect.js');

var exceptionCount = require('../../../lib/modules/thresholds/exceptionCount');

describe('maxValue', function() {
	it('sets breached to true when last result was "exception"', function() {
		var thresholdResult = new exceptionCount({ 
			getLastResults: function() { 
				return ['exception']; 
			} 
		}, { 
			limit: 1 
		}).checkValue();

		expect(thresholdResult.breached).to.be(true);
	});

	it('sets breached to false when last result was not "exception"', function() {
		var thresholdResult = new exceptionCount({ 
			getLastResults: function() { 
				return [1234]; 
			} 
		}, { 
			limit: 1 
		}).checkValue();

		expect(thresholdResult.breached).to.be(false);
	});

	it('sets breached to true when last 3 results are exception and limit is set to 3', function() {
		var thresholdResult = new exceptionCount({ 
			getLastResults: function() { 
				return ['exception', 'exception', 'exception']; 
			} 
		}, { 
			limit: 3
		}).checkValue();

		expect(thresholdResult.breached).to.be(true);
	});

	it('sets breached to false when last 3 results contains 2 exceptions and limit is set to 3', function() {
		var thresholdResult = new exceptionCount({ 
			getLastResults: function() { 
				return ['exception', 1234, 'exception']; 
			} 
		}, { 
			limit: 3
		}).checkValue();

		expect(thresholdResult.breached).to.be(false);
	});
});
