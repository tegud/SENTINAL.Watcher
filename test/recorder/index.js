var expect = require('expect.js');
var Recorder = require('../../lib/recorder');

describe('recorder', function() {
	describe('getResults', function() {
		it('returns the last result added as the first item', function() {
			var recorder = new Recorder({ maxRecordings: 1 });

			recorder.record(123);

			expect(recorder.getResults()[0]).to.eql(123);
		});

		it('returns a second result added as the first item', function() {
			var recorder = new Recorder({ maxRecordings: 1 });

			recorder.record(123);
			recorder.record(456);

			expect(recorder.getResults()[0]).to.eql(456);
		});
	});

	describe('getLastResult', function() {
		it('returns the last result added', function() {
			var recorder = new Recorder({ maxRecordings: 1 });

			recorder.record(123);

			expect(recorder.getLastResult()).to.eql(123);
		});
	});

	describe('limits number of the results to the configured value', function() {
		it('array does not exceed specified length', function() {
			var recorder = new Recorder({ maxRecordings: 1 });

			recorder.record(123);
			recorder.record(456);

			expect(recorder.getResults().length).to.eql(1);
		});
	});
});
