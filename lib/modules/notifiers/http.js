var restify = require('restify');


module.exports = function() {
    var currentStatus = {};
    var config = { port: 3000 };
    var server;

    function getSpecificStatus(path, status) {
        if (path.length > 0) {
            status = status[path[0]];
            path.shift();
            return getSpecificStatus(path, status);
        } else {
            return status;
        }
    }

    return {
        configure: function(newConfig, callback) {
            config = newConfig;
            callback();
        },
        initialise: function(callback) {
            console.log('Starting http notifier...');
            server = restify.createServer({ 
                name: 'SENTINAL.Watcher',
                formatters: {
                    'application/json': function formatJSON(req, res, body) {
                        if (body instanceof Error) {
                            // snoop for RestError or HttpError, but don't rely on
                            // instanceof
                            res.statusCode = body.statusCode || 500;

                            if (body.body) {
                                body = body.body;
                            } else {
                                body = {
                                    message: body.message
                                };
                            }
                        } else if (Buffer.isBuffer(body)) {
                            body = body.toString('base64');
                        }

                        var data;

                        if (req.params && typeof req.params.pretty !== 'undefined' && req.params.pretty !== false) {
                            data = JSON.stringify(body, null, 4);
                        }
                        else {
                            data = JSON.stringify(body);
                        }
                        res.setHeader('Content-Length', Buffer.byteLength(data));

                        return (data);
                    }
                }
            });
            server.pre(restify.pre.sanitizePath());

            server.listen(config.port, function () {
                console.log('%s listening at %s', server.name, server.url)
            });

            server
                .use(restify.fullResponse())
                .use(restify.bodyParser())
                .use(restify.queryParser());

            server.get(/^\/currentStatus\/(.*)/, function(req, res, next) {
                res.send(getSpecificStatus(req.params[0].split('/'), currentStatus));
            });

            server.get('/currentStatus', function(req, res, next) {
                res.send(currentStatus);
            });

            callback();
        },
        close: function(callback) {
            server.close(callback);
        },
        notify: function(eventName, event) {
            currentStatus[eventName] = event;
        }
    };
};
