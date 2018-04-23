/**
  * Handle arguments
  **/
var processArguments = {
	"name": "",
	"type": "",
	"config": {}
};

if (process.argv[2]) {
	try {
		var data = JSON.parse(process.argv[2]);
		
		for (var i in processArguments) {
			if (data[i]) {
				processArguments[i] = data[i];
			}
		}
		
		for (var i in data) {
			if (!processArguments[i]) {
				console.log("undefined key: " + i);
			}
		}
		
	}
	catch (e) {
		throw "expected argument to be JSON";
	}
}

if (processArguments.name === "" || processArguments.config.ip === undefined) {
	throw "expected JSON to contain a name and config.ip";
	return false;
}

if (!processArguments.config.interval) {
	processArguments.config.interval = 1000	;
}

/**
  * DEFAULT API FUNCTION
  **/
  
var homeUiApi = require("../../frontend/mainApi.js");


/**
  * LOGIC
  **/
  
var fs = require("fs");
if (true) {
	var mtime = false;
	function checkMTime () {
		fs.stat(__filename, function (err, res) { 
			if (mtime === false) {
				mtime = res.mtime.getTime();
			}
			else if (mtime !== res.mtime.getTime()) {
				thefileischanged();
			}
		})
	}
	
	setInterval(function () {
		checkMTime();
	}, 2000);
	checkMTime();
}

var harmony = require('harmonyhubjs-client');
 
homeUiApi.requestApi("device", "POST", {
	name: processArguments.name,
	type: "select"
}, function (err, id) {
	if (err || id === false) {
		throw "Error requesting the api";
	}
	else {	
		console.log("connecting to hub"); 
		harmony(processArguments.config.ip).then(function(harmonyClient) {
			console.log("connected to hub"); 
			
			var knownActivities = {};
			var currentActivity = null;
			var goToActivity = null;
			
			var updateKnownActivity = function (activityId) {
				homeUiApi.requestApi("deviceValue", "POST", {
					"id": id,
					"value": JSON.stringify({
						"key": activityId,
						"label": knownActivities[activityId].label
					})
				}, function () { 
					setTimeout(checkOrSetCurrentState, processArguments.config.timeout);
				});
			};
			
			var checkOrSetCurrentState = function () {
				if (goToActivity !== null) {
					var waitForActivity = goToActivity;
					
					//set value and wait till its finished!
					harmonyClient.startActivity(goToActivity);
					
					var checkActivityIsStarted = function () {
						harmonyClient.getCurrentActivity().then(function (activityId) { 
							if (waitForActivity !== activityId) {
								setTimeout(checkActivityIsStarted, processArguments.config.timeout);
							}
							else {
								if (goToActivity === waitForActivity) {
									goToActivity = null;
								}
								checkOrSetCurrentState();
							} 
						});
					};
					
					checkActivityIsStarted();
				}
				else {
					harmonyClient.getCurrentActivity().then(function (activityId) {
						if (currentActivity !== activityId) {
							currentActivity = activityId;
							
							if (knownActivities[activityId]) {
								updateKnownActivity(activityId);
							}
							else {
								refreshKnownActivites(function () {
									if (knownActivities[activityId]) {
										updateKnownActivity(activityId);
									}
									else {
										console.log("Unexpected result from getCurrentActivity vs getActivities", activityId , "does not exists in getActivities result.");
									}
								});
							}
						}
						else {
							setTimeout(checkOrSetCurrentState, processArguments.config.timeout);
						}
					});
				}
			};
			
			var refreshKnownActivites = function (cb) {
				harmonyClient.getActivities().then(function (activities) {
					for (var i = 0; i < activities.length; i ++) {
						knownActivities[activities[i].id] = activities[i];
					}
					
					cb();
				});
			}
			
			checkOrSetCurrentState();
			
			homeUiApi.onDeviceChange(id, function (deviceData) {
				console.log(deviceData, deviceData.value.key !== currentActivity);
				
				if (deviceData.value.key !== currentActivity) {
					goToActivity = deviceData.value.key;
				}
			});
			
		}).catch(function (err) {
			throw err;
		});
	}
});