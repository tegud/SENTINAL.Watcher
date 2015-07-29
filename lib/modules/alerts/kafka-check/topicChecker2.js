/* states
    1: health check initiated
    2: message produced
    3: message consumed

statsd metric example:
    kafka.rateplans.health:3|g
*/

var kafka = require('kafka-node'),
    async = require('async'),
    debug = require('debug')('sentinel:alerts:kafka-check:topicChecker'),
    Promise = require('bluebird');

    producer = require('./producer'),
    consumer = require('./consumer');

module.exports = function (zkConnectionString, topic, partitions, cb) {

    var currentdate = new Date(); 
    var timestamp = currentdate.getDate() + "-"
        + (currentdate.getMonth()+1)  + "-" 
        + currentdate.getFullYear() + " "  
        + currentdate.getHours() + ":"  
        + currentdate.getMinutes() + ":" 
        + currentdate.getSeconds();

    //var timestamp = Date.now();
    var message = 'test ' + timestamp;

    var startTopicCheck = function() {
        return new Promise(function(resolve, reject){
            debug('starting topic check2 : ' + topic, topic, partitions);
            resolve();
        });
    };

    var createClient = function() {
        return new Promise(function(resolve, reject){
            //kafkaClient = new kafka.Client(zkConnectionString, topic + '_sentinel');
            kafkaClient2 = new kafka.Client(zkConnectionString, 'blah');
            kafkaClient2.on('ready', function () {
                resolve(kafkaClient2);
            });

            kafkaClient2.on('error', function(err) {
                reject(err)
            });
        });
    };

    var produceMessage = function() {
        return new Promise(function(resolve, reject){
            debug('start producer for : ' + topic);

            producer(kafkaClient2, topic, partitions, message, function (err) {
                if (err) {
                    return reject(err);
                }

                resolve();
            });
        });
    };

    var finishTopicCheck = function() {
        return new Promise(function(resolve, reject){
            debug('finished topic check2 : ' + topic);
            resolve();
        });
    };

    startTopicCheck()
    .then(function(result){
        return createClient();
    },function(err){
        debug('create client error : ' + err);
        return cb(err);
    })
    .then(function(result){
        debug('client created : ' + result);
        return produceMessage();
    },function(err) {
        debug('produce message error : ' + err);
        return cb(err);
    })
    .then(function(result){
        return finishTopicCheck();
    })
    .then(function(result){
        return cb();
    })
}

