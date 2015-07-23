var zookeeper = require('node-zookeeper-client'),
    events = require('events'),
    util = require('util'),
    async = require('async'),
    debug = require('debug')('Kafka:ZKClientWrapper'),
    client,
    self;

var ZKClientWrapper = function(){
    self = this;
    events.EventEmitter.call(this);  
}

util.inherits(ZKClientWrapper, events.EventEmitter);

ZKClientWrapper.prototype.connectToZk = function(_client){
    client = _client;

    self.emit('connected');
}

ZKClientWrapper.prototype.monitorZkPath = function(zkPath, eventNameToFire) {

    var keepLooping = true;

    debug('Monitoring ZK PATH : ' + zkPath + ' (Event name : ' + eventNameToFire + ')');

    async.whilst(
        function() { return keepLooping; },
        function(callback) {
            monitorPath(zkPath, function(err, data){
                if(err){
                    debug('Firing error event : ' + eventNameToFire + '_ERROR : error : ' + err);
                    self.emit(eventNameToFire + '_ERROR', err);
                    keepLooping = false;
                }
                else {
                    debug('Firing event : ' + eventNameToFire);
                    self.emit(eventNameToFire, data);
                }
                
                callback();
            })
        },
        function(err){
            console.error('Monitoring stopped on ZK PATH : ' + zkPath + ' (Event name : ' + eventNameToFire + ') reason : ' + err);
        }
    );
}

function monitorPath(zkPath, callback){
    client.getChildren(zkPath,
        function(event){
            callback(null, event);
        },
        function(err, children, stat) {
            if (err) {
                console.error('monitorPath (' + zkPath + ') error : ' + err);
                callback(err);
            }
        }
    );
}

ZKClientWrapper.prototype.getZkPathChildren = function(zkPath, callback) {
    client.getChildren(zkPath, function(err, data, stat) {
        if(err)
        {
            console.error('getZkPathChildren (' + zkPath + ') error : ' + err);
            callback(err);
        }

        callback(null, data);
    })
}

ZKClientWrapper.prototype.monitorZkNode = function(zkPathToNode, eventNameToFire) {

    var keepLooping = true;

    debug('Monitoring ZK NODE : ' + zkPathToNode + ' (Event name : ' + eventNameToFire + ')');

    async.whilst(
        function() { return keepLooping; },
        function(callback) {
            monitorNode(zkPathToNode, function(err, data){
                if(err){
                    debug('Firing error event : ' + eventNameToFire + '_ERROR : error : ' + err);
                    self.emit(eventNameToFire + '_ERROR', err);
                    keepLooping = false;
                }
                else {
                    debug('Firing event : ' + eventNameToFire);
                    self.emit(eventNameToFire, data);
                }
                
                callback();
            })
        },
        function(err){
            console.error('Monitoring stopped on ZK NODE : ' + zkPathToNode + ' (Event name : ' + eventNameToFire + ') reason : ' + err);
        }
    );
}

function monitorNode(zkPathToNode, callback){
    client.getData(zkPathToNode,
        function(event){
            callback(null, event);
        },
        function(err, children, stat) {
            if (err) {
                console.error('monitorNode (' + zkPathToNode + ') error : ' + err);
                callback(err);
            }
        }
    );
}

ZKClientWrapper.prototype.getZkPathData = function(zkPath, callback) {
    client.getData(zkPath, function(err, data, stat) {
        if(err)
        {
            console.error('getZkPathData (' + zkPath + ') error : ' + err);
            callback(err);
        }

        callback(null, data);
    })
}

module.exports = ZKClientWrapper;
