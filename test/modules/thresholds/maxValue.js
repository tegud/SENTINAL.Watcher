var expect = require('expect.js');

var maxValue = require('../../../lib/modules/thresholds/maxValue');

describe('maxValue', function() {
	it('sets expected threshold', function() {
		var thresholdResult = new maxValue({ getLastResult: function() {} }, { limit: 1 }).checkValue();

		expect(thresholdResult.maxValue).to.be(1);
	});

	it('sets configured level', function() {
		var thresholdResult = new maxValue({ getLastResult: function() {} }, { level: 'critical', limit: 1 }).checkValue();

		expect(thresholdResult.level).to.be('critical');
	});

	it('defaults level to breach', function() {
		var thresholdResult = new maxValue({ getLastResult: function() {} }, { limit: 1 }).checkValue();

		expect(thresholdResult.level).to.be('breach');
	});

	it('sets threshold description', function() {
		var thresholdResult = new maxValue({ getLastResult: function() {} }, { limit: 1 }).checkValue();

		expect(thresholdResult.threshold).to.be('value > 1');
	});

	it('sets breached true when limit is less than last result', function() {
		var thresholdResult = new maxValue({ getLastResult: function() { return 2; } }, { limit: 1 }).checkValue();

		expect(thresholdResult.breached).to.be(true);
	});

	it('sets breached false when limit is equal to the last result', function() {
		var thresholdResult = new maxValue({ getLastResult: function() { return 1; } }, { limit: 1 }).checkValue();

		expect(thresholdResult.breached).to.be(false);
	});

	it('sets breached false when limit is greater than the last result', function() {
		var thresholdResult = new maxValue({ getLastResult: function() { return 1; } }, { limit: 2 }).checkValue();

		expect(thresholdResult.breached).to.be(false);
	});

	it('checks specified property for breach', function() {
		var thresholdResult = new maxValue({ 
			getLastResult: function() { return { myField: 2 }; } }, 
			{ 
				limit: 1, 
				field: 'myField' 
			}).checkValue();

		expect(thresholdResult.breached).to.be(true);
	});

	it('sets threshold description\'s field name', function() {
		var thresholdResult = new maxValue({ getLastResult: function() { return { myField: 1 }; } }, 
			{ 
				limit: 1, 
				field: 'myField' 
			}).checkValue();

		expect(thresholdResult.threshold).to.be('myField > 1');
	});
});
