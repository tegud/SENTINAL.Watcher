var ZKClientWrapper = require('./ZKClientWrapper'),
    async = require('async'),
    _ = require('lodash'),
    debug = require('debug')('sentinel:alerts:kafka-check:KafkaMonitor'),
    EventedArray = require('array-events'),
    events = require('events'),
    util = require('util'),
    zkClientWrapper = new ZKClientWrapper(),
    currentBrokers = new EventedArray(),
    watchedTopics = new EventedArray(),
    topicStateWatchList = new EventedArray(),
    topicLeaderState = new EventedArray(),
    brokerPath = '/brokers/ids',
    topicsPath = '/brokers/topics',
    self; 

//allow lots of listeners to be set up
zkClientWrapper.setMaxListeners(100);     

//-------------------------------------------
//Events that will be emited from this module
watchedTopics.on('add', function(event){
    self.emit('NEW_TOPIC', event);
});

currentBrokers.on('add', function(event){    
    self.emit('BROKER_ADDED', event);
    debug('broker added', event);
});

currentBrokers.on('remove', function(event){
    self.emit('BROKER_REMOVED', event);
});

topicStateWatchList.on('add', function(event){

    //Start monitoring the leader state
    var topicLeaderInformation = {
        "topicName" : event.topicName,
        "topicLeaderInformationPath" : event.topicStatePath,
        "leader" : 0,
        "topicPartitionId" : event.topicPartitionId
    };

    topicLeaderState.push(topicLeaderInformation);

    //Listen for changes to the topic state
    zkClientWrapper.on(event.topicStateChangedEventName, function(eventData){

        zkClientWrapper.getZkPathData(eventData.path, function(err, data){
            if(err){
                return debug(err);        
            }  

            var topicStateData = {
                "topicName" : event.topicName,
                "topicPartitionId" : event.topicPartitionId,
                "topicStateData" : JSON.parse(data)
            }          

            self.emit('TOPIC_STATE_DATA_CHANGED', topicStateData)

            //Emit to other interested parties
            topicLeaderState.emit('add', topicLeaderInformation);
        });
    }); 
});

topicLeaderState.on('add', function(event){
    zkClientWrapper.getZkPathData(event.topicLeaderInformationPath, function(err, data){
        if(err){
            return debug(err);  
        }   

        var topicStateInformation = JSON.parse(data);         

        event.leader = topicStateInformation.leader;

        if(event.leader == -1){
            self.emit('TOPIC_HAS_NO_LEADER', event);
        }
    }); 
});
//-------------------------------------------

var KafkaMonitor = function(zookeeperClient){
    self = this;
    events.EventEmitter.call(this);  

    zkClientWrapper.connectToZk(zookeeperClient);
}

util.inherits(KafkaMonitor, events.EventEmitter);

KafkaMonitor.prototype.getCurrentBrokers = function(){
    return currentBrokers;
}  

KafkaMonitor.prototype.getTopicsBeingWatched = function(){
    return watchedTopics;
}  

zkClientWrapper.once('connected', function(){
    debug('Connected to Zookeeper');

    process.nextTick(function() {
        async.parallel([
            function(){
                debug('Starting broker monitoring');
                monitorBrokers();
                debug('Broker monitoring started');
            },
            function(){
                async.series([
                    function(callback){
                        debug('Building list of current topics to monitor');
                        buildTopicListToMonitor(callback);
                        debug('Built list of current topics to monitor');
                    },
                    function(callback){
                        debug('Starting new topic monitoring');
                        watchTopicPathForNewTopics();
                        debug('New topic monitoring started');
                        callback();
                    },
                    function(callback){
                        debug('Starting topic state monitoring');
                        watchTopicStateForChanges();
                        debug('Topic state monitoring started');
                        callback();
                    }
                ])
            }
        ]);
    });
})

function monitorBrokers() {
    async.series([
        function(callback){
            var cbCalled = false;
            zkClientWrapper.getZkPathChildren(brokerPath, function(err, data){
                if(err){
                    debug(err);
                    if (!cbCalled) {
                        cbCalled = true;

                        var broker = {
                            "errorMessage" : err
                        };

                        currentBrokers.push(broker);

                        return callback(err);
                    } else {
                        return;
                    }
                }

                async.each(data, function(broker, callback){
                    currentBrokers.push(broker);
                    callback();
                });

                if (!cbCalled) {
                    cbCalled = true;
                    callback(null);
                }
            });            
        },
        function(callback){

            var brokerFiredEventName = "BROKER_CHANGED";

            zkClientWrapper.monitorZkPath(brokerPath, brokerFiredEventName);

            zkClientWrapper.on(brokerFiredEventName, function(data){

                zkClientWrapper.getZkPathChildren(brokerPath, function(err, data){
                    if(err){
                        return debug(err);
                    }

                    var brokersChanged = _.difference(currentBrokers, data);

                    //if 'brokersChanged' contains any values alert that
                    //these brokers have become unregistered with zookeeper
                    if(brokersChanged.length > 0){
                        _.each(brokersChanged, function(broker){
                            var indexToRemove = _.findIndex(currentBrokers, function(existingBroker) {
                                if(existingBroker == broker){
                                    return existingBroker;
                                }
                            });

                            currentBrokers.splice(indexToRemove,1);
                        });    
                    }
                    else {
                        //if 'brokersChanged' is empty a new broker has been registered
                        //with zookeeper
                        var newBroker = _.difference(data, currentBrokers);
                        _.each(newBroker, function(broker){
                            currentBrokers.push(broker);
                        });
                    }

                    return;
                });     
            })

            zkClientWrapper.on(brokerFiredEventName + '_ERROR', function(err){
                debug(brokerFiredEventName + '_ERROR : ' + err);
                callback();
            })
        }
    ]);
}

function buildTopicListToMonitor(completedCallback){

    var currentTopics;

    async.series([
        function(callback){
            var cbCalled = false;
            zkClientWrapper.getZkPathChildren('/brokers/topics', function(err, data){
                if(err){
                    debug(err);
                    if (!cbCalled) {
                        cbCalled = true;
                        return callback(err);
                    } else {
                        return;
                    }
                }

                currentTopics = data;

                if (!cbCalled) {
                    callback(null);
                }
            })    
        },
        function(callback){

            async.each(currentTopics, function(topic, callback){
                addTopicToWatchList(topic, callback);
            }, 
            function(err){
                if(err) {
                    debug(err);
                    return callback(err);
                }
                else {
                    callback();
                }
            });
        },
        function(callback){
            completedCallback();
            callback(null);
        }
    ],
    function(err, results){
        if(err){
            debug('buildTopicListToMonitor : ' + err);
        }
    });
}

function addTopicToWatchList(topic, callback){
    var watchedTopic = {
        "topicName" : null,
        "topicPath" : null,
        "partitions" : [],
    };

    watchedTopic.topicName = topic;
    watchedTopic.topicPath = '/brokers/topics/' + topic;

    buildPartitionDataForTopic(watchedTopic.topicName, watchedTopic.topicPath, function(err, data){
        if(err){
            return callback(err);
        }
        else{
            async.each(data, function(stateWatchPath, callback){
                watchedTopic.partitions.push(stateWatchPath);
                callback();
            });

            watchedTopics.push(watchedTopic);
            
            callback();
        }
    });
}

function buildPartitionDataForTopic(topicName, topicPath, callback){
    zkClientWrapper.getZkPathData(topicPath, function(err, data){
        if(err){
            debug(err);
            return callback(err);
        }

        var topicData = JSON.parse(data);
        var partitions = [];

        async.forEachOf(topicData.partitions, function(item, key, callback){

            //get the current leader for the partition
            var partitionStatePath = "/brokers/topics/" + topicName + "/partitions/" + key + "/state";
            var leader = 0;

            async.series([
                function(callback){
                    zkClientWrapper.getZkPathData(partitionStatePath, function(err, data){
                        if(err){
                            debug(err);        
                            return callback();
                        }  

                        var partitionNodeData = JSON.parse(data);
                        leader = partitionNodeData.leader;

                        callback();
                    });
                },
                function(callback){
                    var partitionData = {
                        "stateWatchPath" : partitionStatePath,
                        "partitionId" : key,
                        "leader" : leader
                    };

                    partitions.push(partitionData);
                    callback();
                }
            ],
            function(err, results){
                callback();                
            });
        },
        function(err){
            if(err) {
                debug(err);
                return callback(err);
            }
            else {
                callback(null, partitions);
            }
        });
    });    
}

function watchTopicPathForNewTopics(){

    //The assumption will be made here that only topics will be added
    //As deleting topics is an admin task and won't (hopefully) happen that often

    var topicFiredEventName = "TOPIC_CHANGED";

    zkClientWrapper.monitorZkPath(topicsPath, topicFiredEventName);

    zkClientWrapper.on(topicFiredEventName, function(data){

        zkClientWrapper.getZkPathChildren(topicsPath, function(err, data){
            if(err){
                return debug(err);        
            }            

            var existingTopics = _.map(watchedTopics, 'topicName');
            var addedTopic =  _.difference(data, existingTopics);

            addedTopic.forEach(function (v) {
                addTopicToWatchList(v, function(){
                    return;
                });
            });
        });
    });   
}

function addWatchToTopicStatePath(topicName, statePath, partitionId){

    var topicStateEvent = {
        "topicName" : topicName,
        "topicStateChangedEventName" : topicName.toUpperCase() + "_" + partitionId + "_CHANGED",
        "topicStatePath" : statePath,
        "topicPartitionId" : partitionId
    }

    zkClientWrapper.monitorZkNode(topicStateEvent.topicStatePath, topicStateEvent.topicStateChangedEventName);

    topicStateWatchList.push(topicStateEvent);
}

function watchTopicStateForChanges(){

    async.each(watchedTopics, function(watchedTopic, callback){
        async.each(watchedTopic.partitions, function(partitionData, callback){
            addWatchToTopicStatePath(watchedTopic.topicName, partitionData.stateWatchPath, partitionData.partitionId);
            callback();
        });

        callback();
    });
}

module.exports = KafkaMonitor;

