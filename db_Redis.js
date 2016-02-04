var redis = require('redis'),
	async = require('async'),
	winston = require('winston'),
	db;

db = redis.createClient();
var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'debug',
            filename: './logs/all-log',
            colorize: false
        })
    ],
    exitOnError: false
});


db.on('error', function(err) {
	logger.warn("%s". err);
});

exports.init = function() {};

exports.checkInfo = function(user, api_key, publicPath, callback) {
	var unit;

	db.smembers(user, function(err, api_keys) {
		if (err) {
			return callback(err, null);
		} else {
			async.each(api_keys, function(entry, task_callback) {
				if (api_key === entry) {
					db.hgetall(api_key, function(err, api_key_info) {
						if (err) {
							task_callback(err);
						} else {
							checkInfoAux(api_key_info, publicPath, function(err, res) {
								if (err) {
									task_callback(err);
								} else {
									unit = res;
									task_callback();
								}
							});
						}
					});
				} else {
					task_callback();
				}
			}, function(err) {
				if (err) {
					return callback(err, null);
				} else {
					return callback(null, unit);
				}
			});
		}
	});
}

checkInfoAux = function(api_key, publicPath, callback) {
	var unit;

	db.smembers('resources', function(err, resources) {
		if (err) {
			return callback(err, null);
		} else {
			async.each(resources, function(resource, task_callback) {
				db.hgetall(resource, function(err, res) {
					if (err) {
						task_callback(err);
					} else {
						db.hgetall(res.publicPath, function(err, serv) {
							if (err) {
								task_callback(err);
							} else {
								if (res !== null && 
									api_key.organization === res.org && 
									api_key.name === res.name && 
									api_key.version === res.version &&
									publicPath === res.publicPath) {
										unit = res.unit;
										task_callback();
								} else {
									task_callback();
								}
							}
						});
					}
				});
			}, function(err) {
				if (err) {
					return callback(err, null);
				} else {
					return callback(null, unit);
				}
			});
		} 
	});
};

// CLI: deleteService [path]
exports.deleteService = function(path, callback) {
	var multi = db.multi();

	multi.del(path);
	multi.srem('public', path);

	multi.exec(function(err) {
		if (err) {
			return callback(err);
		} else {
			return callback(null);
		}
	});
};

// CLI: getService [publicPath]
exports.getService = function(publicPath, callback) {
	db.hgetall(publicPath, function(err, obj) {
		if (err) {
			return callback(err, null);
		} else {
			return callback(null, obj);
		}
	});
};

// CLI: addService [publicPath] [url] [port]
exports.newService = function(publicPath, url, port, callback){
	var multi = db.multi();

	multi.sadd(['public', publicPath]);
	multi.hmset(publicPath, { 'url': url, 'port': port });
	multi.exec(function(err) {
		if (err) {
			return callback(err);
		} else {
			return callback(null);
		}
	});
};

// CLI: getInfo [user]
exports.getInfo = function(user, callback) {
	var toReturn = [];

	db.smembers(user, function(err, api_keys) {
		if (err) {
			return callback(err, null);
		} else {
			async.each(api_keys, function(api_key, task_callback) {
				db.hgetall(api_key, function(err, api_key_info) {
					if (err) {
						task_callback(err);
					} else {
						toReturn.push({
								API_KEY: api_key,
								organization: api_key_info['organization'],
								name: api_key_info['name'],
								version: api_key_info['version']
						});
						task_callback();
					}
				});
			}, function(err) {
				if (err) {
					return callback(err, null);
				} else {
					return callback(null, toReturn);
				}
			});
		} 
	});
};

exports.addResource = function(data, callback) {
	var multi = db.multi();

	multi.sadd(['resources', data.publicPath + data.offering.organization + data.offering.name + data.offering.version]);
	multi.hmset(data.publicPath + data.offering.organization + data.offering.name + data.offering.version, {
				'publicPath': data.publicPath,
				'org': data.offering.organization,
				'name': data.offering.name,
				'version': data.offering.version,
				'record_type': data.record_type,
				'unit': data.unit,
				'component_label': data.component_label
	});

	multi.exec(function(err) {
		if (err) {
			return callback(err);
		} else {
			return callback(null);
		}
	});
};

exports.getUnit = function(path, organization, name, version, callback) {
	db.hgetall(path + organization + name + version, function(err, resource) {
		if (err) {
			return callback(err, null);
		} else if (resource == null) { // Service no created in db
			return callback(null, null);
		} else {
			return callback(null, resource.unit);
		}
	});
}

exports.getApiKeys = function(callback){
	db.smembers('API_KEYS', function(err, api_keys) {
		if (err) {
			return callback(err, null);
		} else {
			return callback(null, api_keys);
		}
	});
}

exports.getResources = function(api_key, callback) {
	db.smembers(api_key + '_paths', function(err, paths) {
		if (err) {
			return callback(err, null);
		} else {
			return callback(null, paths);
		}
	});
}

exports.getNotificationInfo = function(api_key, path, callback) {
	db.hgetall(api_key, function(err, api_key_info) {
		if (err) {
			return callback(err, null);
		} else {
			db.hgetall(api_key_info.actorID + api_key + path, function(err, resource) {
				if (err) {
					return callback(err, null);
				}else{
					return callback(null, {
						"actorID": api_key_info.actorID, 
	                    "API_KEY": api_key,
	                    "publicPath": path,
	                    "organization": api_key_info.organization,
	                    "name": api_key_info.name,
	                    "version": api_key_info.version,
	                    "correlation_number": resource.correlation_number,
	                    "num": resource.num,
	                    "reference": api_key_info.reference
					});
				}
			});
		}
	});
}

exports.checkBuy = function(api_key, path, callback) {
	var bought = false;

	db.smembers(api_key + '_paths', function(err, paths) {
		if (err) {
			return callback(err, null);
		} else {
			async.each(paths, function(entry, task_callback) {
				if (entry === path) {
					bought = bought || true;
					task_callback();
				} else {
					task_callback();
				}
			}, function() {
				return callback(null, bought);
			})
		}
	});
}

exports.addInfo = function(api_key, data, callback) {
	var multi = db.multi();

	multi.sadd(['API_KEYS', api_key]);
	multi.hmset(api_key, {
				'organization': data.organization,
				'name': data.name,
				'version': data.version,
				'actorID': data.actorID,
				'reference': data.reference
	});
	multi.sadd([data.actorID, api_key]);
	async.forEachOf(data.accounting, function(acc, p, task_callback) {
		//console.log(acc)
		multi.sadd([api_key + '_paths', p]);
		multi.hmset(data.actorID + api_key + p, {
			'actorID': data.actorID,
			'API_KEY': api_key,
			'num': acc.num,
			'publicPath': p,
			'correlation_number': acc.correlation_number
		});
		task_callback();
	}, function() {
		multi.exec(function(err) {
			if (err) {
				return callback(err);
			} else {
				return callback(null);
			}
		});
	});
};

exports.getApiKey = function(user, offer, callback) {
	db.smembers(user, function(err, api_keys) {
		if (err) {
			return callback(err, null);
		} else if (api_keys.length !== 0) {
			var count = 0;

			async.filter(api_keys, function(api_key, task_callback) {
				db.hgetall(api_key, function(err, offerAcc) {
					if (err) {
						return callback(err, null);
					} else if (offerAcc['organization'] === offer['organization'] &&
						offerAcc['name'] === offer['name'] &&
						offerAcc['version'] == offer['version']) {
							task_callback(true);
					} else {
						task_callback(false);
					}
				});
			}, function(res) {
				if (res.length != 0) {
					return callback(null, res[0]);
				} else {
					return callback(null, null);
				}
				
			});
		} else {
			return callback(null, null);
		}
	});
};

exports.count = function(actorID, API_KEY, publicPath, amount, callback) {
	if (amount < 0 ) {
		return callback('[ERROR] The aomunt must be greater than 0');
	} else {
		db.exists(actorID + API_KEY + publicPath, function(err, reply){
			if (err) {
				return callback(err)
			} else if (reply === 0) {
				return callback('[ERROR] The specified resource doesn\'t exist')
			} else {
				db.hget(actorID + API_KEY + publicPath, 'num', function(err, num) {
					if (err) {
						return callback(err);
					} else {
						db.hmset(actorID + API_KEY + publicPath, {
							'num' : (parseFloat(num) + amount).toString()
						}, function(err) {
							if (err) {
								return callback(err);
							} else {
								return callback(null);
							}
						});
					}
	    		});
			}
		});
	}
};

exports.resetCount = function(actorID, API_KEY, publicPath, callback) {
	db.hget(actorID + API_KEY + publicPath, 'correlation_number', function(err, correlation_number) {
		if (err) {
			return callback(err);
		} else if (correlation_number !== null) {
			correlation_number = parseInt(correlation_number) + 1;
			db.hmset(actorID + API_KEY + publicPath, {
				'correlation_number' : correlation_number,
				'num' : '0'
			}, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
			});
		} else  {
			return callback(null);
		}
	});
};

exports.getAccountingInfo = function(publicPath, offer, callback) {
	var toReturn = {};

	db.hgetall(publicPath + offer.organization + offer.name + offer.version, function(err, resource) {
		if (err) {
			return callback(err, null);
		} else if (resource !== null) {
			toReturn = {
				recordType: resource.recordType,
				unit: resource.unit,
				component: resource.component
			}
			return callback(null, toReturn);
		} else {
			return callback(null, null);
		}
	});
};

exports.addCBSubscription = function( API_KEY, publicPath, subscriptionID, ref_host, ref_port, ref_path, unit, callback) {
	db.hmset(subscriptionID, {
		'API_KEY': API_KEY,
		'publicPath': publicPath,
		'ref_host': ref_host,
		'ref_port': ref_port,
		'ref_path': ref_path,
		'unit': unit
	}, function(err) {
		if(err){
			return callback(err);
		} else {
			return callback(null);
		}
	});
};

exports.getCBSubscription = function(subscriptionID, callback) {
	db.hgetall(subscriptionID, function(err, res) {
		if (err) {
			return callback(err, null)
		} else {
			return callback(null, res);
		}
	});
};

exports.deleteCBSubscription = function(subscriptionID, callback) {
	db.del(subscriptionID, function(err) {
		if (err) {
			return callback(err);
		} else {
			return callback(null);
		}
	});
};