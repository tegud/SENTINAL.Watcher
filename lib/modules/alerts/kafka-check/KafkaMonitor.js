var ZKClientWrapper = require('./ZKClientWrapper'),
    async = require('async'),
    _ = require('lodash'),
    debug = require('debug')('Kafka:KafkaMonitor'),
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
zkClientWrapper.setMaxListeners(20);     

//-------------------------------------------
//Events that will be emited from this module
watchedTopics.on('add', function(event){
    self.emit('NEW_TOPIC', event.topicName);
});

currentBrokers.on('add', function(event){
    self.emit('BROKER_ADDED', event);
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
                debug(err);        
            }            

            self.emit('TOPIC_STATE_DATA_CHANGED', data)

            //Emit to other interested parties
            topicLeaderState.emit('add', topicLeaderInformation);
        });
    }); 
});

topicLeaderState.on('add', function(event){
    zkClientWrapper.getZkPathData(event.topicLeaderInformationPath, function(err, data){
        if(err){
            debug(err);        
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

    async.parallel([
        function(){
            monitorBrokers();
            debug('Broker monitoring started');
        },
        function(){
            async.series([
                function(callback){
                    buildTopicListToMonitor(callback);
                    debug('Built list of current topics to monitor');
                },
                function(callback){
                    watchTopicPathForNewTopics();
                    debug('New topic monitoring started');
                    callback();
                },
                function(callback){
                    watchTopicStateForChanges();
                    debug('Topic state monitoring started');
                    callback();
                }
                // function(callback){
                //     monitorTopicsForLeaderChangeOrLoss();
                //     debug('Monitoring topics for leader change or loss started');
                //     callback();
                // }
            ])
        }
    ]);
})

function monitorBrokers() {
    async.series([
        function(callback){
            zkClientWrapper.getZkPathChildren(brokerPath, function(err, data){
                if(err){
                    debug(err);
                    callback(err);        
                }

                async.each(data, function(broker, callback){
                    currentBrokers.push(broker);
                    callback();
                });

                callback(null);
            });            
        },
        function(callback){

            var brokerFiredEventName = "BROKER_CHANGED";

            zkClientWrapper.monitorZkPath(brokerPath, brokerFiredEventName);

            zkClientWrapper.on(brokerFiredEventName, function(data){

                zkClientWrapper.getZkPathChildren(brokerPath, function(err, data){
                    if(err){
                        debug(err);
                        return;        
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
            zkClientWrapper.getZkPathChildren('/brokers/topics', function(err, data){
                if(err){
                    debug(err);
                    callback(err);       
                }

                currentTopics = data;

                callback(null);
            })    
        },
        function(callback){

            async.each(currentTopics, function(topic, callback){
                addTopicToWatchList(topic, callback);
            }, 
            function(err){
                if(err) {
                    debug(err);
                    callback(err);
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
            debug('Something went wrong : ' + err);
        }
    });
}

function addTopicToWatchList(topic, callback){
    var watchedTopic = {
        "topicName" : null,
        "topicPath" : null,
        "stateWatchPaths" : [],
    };

    watchedTopic.topicName = topic;
    watchedTopic.topicPath = '/brokers/topics/' + topic;

    buildStateWatchPathsForTopic(watchedTopic.topicName, watchedTopic.topicPath, function(err, data){
        if(err){
            callback(err);
        }
        else{
            async.each(data, function(stateWatchPath, callback){
                watchedTopic.stateWatchPaths.push(stateWatchPath);
                callback();
            });

            watchedTopics.push(watchedTopic);
            
            callback();
        }
    });
}

function buildStateWatchPathsForTopic(topicName, topicPath, callback){
    zkClientWrapper.getZkPathData(topicPath, function(err, data){
        if(err){
            debug(err);
            callback(err);
        }

        var topicData = JSON.parse(data);
        var stateWatchPaths = [];

        async.forEachOf(topicData.partitions, function(item, key, callback){
            stateWatchPaths.push('/brokers/topics/' + topicName + '/partitions/' + key + '/state');
            callback();
        },
        function(err){
            if(err) {
                debug(err);
                callback(err);
            }
            else {
                callback(null, stateWatchPaths);
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
                debug(err);        
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

function addWatchToTopicStatePath(topicName, statePath){

    var partitionId = statePath.split('/')[5];

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
        async.each(watchedTopic.stateWatchPaths, function(statePath, callback){
            addWatchToTopicStatePath(watchedTopic.topicName, statePath);
            callback();
        });

        callback();
    });
}

module.exports = KafkaMonitor;

