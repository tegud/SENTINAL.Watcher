var expect = require('expect.js');
var proxyquire = require('proxyquire');
var httpNotifier = require('../../../lib/modules/notifiers/http');
var http = require('http');

describe('http notifier', function() {
    var notifier;
    var config = {
        type: "http",
        port: 3000
    };

    beforeEach(function(done) {
        notifier = httpNotifier();
        notifier.configure(config, function () {
            notifier.initialise(done);
        });
    });

    afterEach(function() {
        notifier.close();
        notifier = undefined;
    });

    it('exposes http endpoint', function(done) {
        http.get('http://localhost:3000/currentStatus', function(res) {
            expect(res.statusCode).to.be(200);
            done();
        });
    });

    it('returns the current status once an event occurs', function(done) {
        notifier.notify("myEventName", { here: "isSomeData"});

        http.get('http://localhost:3000/currentStatus', function(res) {
            var data = '';

            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                var currentStatus = JSON.parse(data);
                expect(currentStatus).to.eql({ "myEventName": { "here": "isSomeData"}});
                done();
            });
        });
    });

    it('combines status for multiple events', function(done) {
        notifier.notify("myEventName", { here: "isSomeData"});
        notifier.notify("event2", { here: "isSomeOtherData"});

        http.get('http://localhost:3000/currentStatus', function(res) {
            var data = '';

            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                var currentStatus = JSON.parse(data);
                expect(currentStatus).to.eql({ "myEventName": { "here": "isSomeData"}, "event2": { "here": "isSomeOtherData"}});
                done();
            });
        });
    });

    it('replaces existing status if multiple events from same source', function(done) {
        notifier.notify("myEventName", { here: "isSomeData"});
        notifier.notify("myEventName", { here: "isSomeOtherData"});

        http.get('http://localhost:3000/currentStatus', function(res) {
            var data = '';

            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                var currentStatus = JSON.parse(data);
                expect(currentStatus).to.eql({ "myEventName": { "here": "isSomeOtherData"}});
                done();
            });
        });
    });
});