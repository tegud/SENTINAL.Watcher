var proxyquire = require('proxyquire');
var expect = require('expect.js');
var moment = require('moment');

var quantityTextFactory = proxyquire('../../../lib/modules/eventBuilders/quantityText', {});

describe('quantityText', function() {
	describe('appends quantityText to the eventInfo', function() {
		it('sets defaultValue when event level is not matched', function(done) {
			var quantityTextBuilder = quantityTextFactory({ defaultValue: 'normal' });

			quantityTextBuilder({ info: {} }, function(err, event) {
				expect(event.info.quantityText).to.be('normal');
				done();
			});
		});

		it('sets to matching event value', function(done) {
			var quantityTextBuilder = quantityTextFactory({ levels: { 'breach': 'high' } });

			quantityTextBuilder({ level: 'breach', info: {} }, function(err, event) {
				expect(event.info.quantityText).to.be('high');
				done();
			});
		});
	});
});
