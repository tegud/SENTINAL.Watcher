var expect = require('expect.js');
var async = require('async');
var http = require('http');
var proxyquire = require('proxyquire');

var sources = require('../../../lib/modules/sources');
var notifiers = require('../../../lib/modules/notifiers');
var healthChecker = require('../../../lib/modules/sources/healthChecker');
var healthCheck;

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

function configureAndInitialiseSource(config, callback) {
    var source = new healthChecker();
    async.series([
        async.apply(source.configure, config),
        source.initialise,
        function(callback) {
            sources.registerSource('healthChecker', source);
            callback();
        }
    ], callback);

    return source;
}

describe('healthCheck', function() {
    var server;
    var responseStatusCode;

    beforeEach(function(done) {
        responseStatusCode = 200;

        notifiers.clear();
        sources.clear();

        healthCheck = proxyquire('../../../lib/modules/alerts/healthCheck', {
            '../../modules/schedulers': fakeScheduler
        });

        async.series([
            function(callback) {
                server = http.createServer(function (req, res) {
                    res.writeHead(responseStatusCode);
                    res.end();
                });

                server.listen(5555, function() {
                    callback();
                });
            }
        ], done);
    });

    afterEach(function() {
        server.close();
    });

    describe('returns status of configured server', function() {
        it('returns OK status when server is responding as expected', function(done) {
            var alert = new healthCheck();

            notifiers.registerNotifier('test', {
                notify: function(eventName, event) {
                    expect(event.serverSets.web.groups.servers['server-01'].status).to.be('OK');
                    done();
                }
            });

            async.series([
                async.apply(configureAndInitialiseSource, {
                    "servers": [
                        { host: "localhost", name: "server-01", port: 5555, healthCheck: 'test' }
                    ],
                    healthCheckers: {
                        test: {
                            path: "/status",
                            status: [
                                { "name": "OK", statusRegex: '200' }
                            ]
                        }
                    }
                }),
                async.apply(alert.configure, {
                    source: 'healthChecker',
                    notifications: [
                        { "type": "test", "levels": ["info"] }
                    ]
                }),
                alert.initialise
            ]);
        });

        it('returns Unknown status when server is an unknown status', function(done) {
            var alert = new healthCheck();

            responseStatusCode = 500;

            notifiers.registerNotifier('test', {
                notify: function(eventName, event) {
                    expect(event.serverSets.web.groups.servers['server-01'].status).to.be('Unknown');
                    done();
                }
            });

            async.series([
                async.apply(configureAndInitialiseSource, {
                    "servers": [
                        { host: "localhost", name: "server-01", port: 5555, healthCheck: 'test' }
                    ],
                    healthCheckers: {
                        test: {
                            path: "/status",
                            status: [
                                { "name": "OK", statusRegex: '200' }
                            ]
                        }
                    }
                }),
                async.apply(alert.configure, {
                    source: 'healthChecker',
                    notifications: [
                        { "type": "test", "levels": ["info"] }
                    ]
                }),
                alert.initialise
            ]);
        });

        it('returns Error status when server when client cannot connect', function(done) {
            var alert = new healthCheck();

            notifiers.registerNotifier('test', {
                notify: function(eventName, event) {
                    expect(event.serverSets.web.groups.servers['server-02'].status).to.be('ERROR');
                    done();
                }
            });

            async.series([
                async.apply(configureAndInitialiseSource, {
                    "servers": [
                        { host: "localhost", name: "server-02", port: 5556, healthCheck: 'test' }
                    ],
                    healthCheckers: {
                        test: {
                            path: "/status",
                            status: [
                                { "name": "OK", statusRegex: '200' }
                            ]
                        }
                    }
                }),
                async.apply(alert.configure, {
                    source: 'healthChecker',
                    notifications: [
                        { "type": "test", "levels": ["info"] }
                    ]
                }),
                alert.initialise
            ]);
        });

        it('returns Error status when server returns a 500 code', function(done) {
            var alert = new healthCheck();

            responseStatusCode = 500;

            notifiers.registerNotifier('test', {
                notify: function(eventName, event) {
                    expect(event.serverSets.web.groups.servers['server-02'].status).to.be('ERROR');
                    done();
                }
            });

            async.series([
                async.apply(configureAndInitialiseSource, {
                    "servers": [
                        { host: "localhost", name: "server-02", port: 5555, healthCheck: 'test' }
                    ],
                    healthCheckers: {
                        test: {
                            path: "/status",
                            status: [
                                { "name": "OK", statusRegex: '200' },
                                { "name": "ERROR", statusRegex: '5[0-9]{0,2}' }
                            ]
                        }
                    }
                }),
                async.apply(alert.configure, {
                    source: 'healthChecker',
                    notifications: [
                        { "type": "test", "levels": ["info"] }
                    ]
                }),
                alert.initialise
            ]);
        });

        it('returns Timeout status when server request exceeds timeout', function(done) {
            var alert = new healthCheck();

            responseStatusCode = 500;

            notifiers.registerNotifier('test', {
                notify: function(eventName, event) {
                    expect(event.serverSets.web.groups.servers['server-02'].status).to.be('TIMEOUT');
                    done();
                }
            });

            async.series([
                async.apply(configureAndInitialiseSource, {
                    "servers": [
                        { host: "localhost", name: "server-02", port: 5556, healthCheck: 'test' }
                    ],
                    healthCheckers: {
                        test: {
                            path: "/status",
                            timeout: { timeout: 50, status: 'TIMEOUT' },
                            status: [
                                { "name": "OK", statusRegex: '200' },
                                { "name": "ERROR", statusRegex: '5[0-9]{2}' }
                            ]
                        }
                    }
                }),
                async.apply(alert.configure, {
                    source: 'healthChecker',
                    notifications: [
                        { "type": "test", "levels": ["info"] }
                    ]
                }),
                alert.initialise
            ]);
        });

        it('returns Deploying status when server timesout after ', function(done) {
            var alert = new healthCheck();

            responseStatusCode = 500;

            notifiers.registerNotifier('test', {
                notify: function(eventName, event) {
                    expect(event.serverSets.web.groups.servers['server-02'].status).to.be('TIMEOUT');
                    done();
                }
            });

            async.series([
                async.apply(configureAndInitialiseSource, {
                    "servers": [
                        { host: "localhost", name: "server-02", port: 5556, healthCheck: 'test' }
                    ],
                    healthCheckers: {
                        test: {
                            path: "/status",
                            timeout: { timeout: 50, status: 'TIMEOUT' },
                            status: [
                                { "name": "OK", statusRegex: '200' },
                                { "name": "ERROR", statusRegex: '5[0-9]{2}' }
                            ]
                        }
                    }
                }),
                async.apply(alert.configure, {
                    source: 'healthChecker',
                    notifications: [
                        { "type": "test", "levels": ["info"] }
                    ]
                }),
                alert.initialise
            ]);
        });
    });
});