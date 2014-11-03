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
            server = restify.createServer({ name: 'SENTINAL.Watcher' });
            server.pre(restify.pre.sanitizePath());

            server.listen(config.port, function () {
                console.log('%s listening at %s', server.name, server.url)
            });

            server
                .use(restify.fullResponse())
                .use(restify.bodyParser());

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
