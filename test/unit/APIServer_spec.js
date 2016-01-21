var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');

var mocker = function(implementations, callback) {
	var spies = {
		app: {},
		db: {},
		req: {},
		res: {},
		async: {},
		url: {},
		config: {},
	};
	var api_server;
	// Define default mockers
	var mocks = {
		app: {
			set: function(prop, value) {},
			use: function(middleware) {},
			post: function(path, handler) {},
			get: function(path, handler) {},
		},
		db: {},
		req: {},
		res: {},
		url: {},
		config: {},
		async: {}
	};
	// Complete app_mock implementation and add spies
	async.each(Object.keys(implementations), function(obj, task_callback1) {
		async.each(Object.keys(implementations[obj]), function(implem, task_callback2) {
			mocks[obj][implem.toString()] = implementations[obj][implem.toString()];
			if ( typeof implementations[obj][implem] == 'function' && implementations[obj][implem] != undefined) {
				if (obj == 'req' || obj == 'res') {
					spies[obj][implem.toString()] = sinon.spy(implementations[obj], implem.toString());
				} else {
					spies[obj][implem.toString()] = sinon.spy(mocks[obj], implem.toString());
				}
				task_callback2();
			} else {
				task_callback2();
			}
		}, function() {
			return task_callback1();
		});
	}, function() {
		api_server = proxyquire('../../APIServer', {
			express: function() {
				return mocks.app;
			},
			'./config': mocks.config,
			'./db': mocks.db,
			'url': mocks.url,
			'async': mocks.async
		});
		return callback(api_server, spies);
	});
}

describe('Testing APIServer', function() {

	describe('run', function() {
		var implementations;

		it('correct', function() {
			implementations = {
				app: {
					listen: function(port){},
					get: function(prop){ return 'prop'}
				},
				config: {
					database: './db'
				}
			}
			mocker(implementations, function(api_server_mock, spies) {
				api_server_mock.run();
				assert.equal(spies.app.listen.callCount, 1);
				assert.equal(spies.app.get.callCount, 2);
				assert.equal(spies.app.get.getCall(1).args[0], 'port');
			});
		});
	});

	describe('keysHandler', function() {
		var implementations;

		it("error (400), missed header 'X-Actor-ID'", function(done) {
			implementations = {
				req: {
					get: function(header) {
						return undefined;
					}
				},
				res: {
					status: function(stat) {
						return this;
					},
					send: function() {}
				},
				config: {
					database: './db'
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			};
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				done();
			});
		});

		it('error, get info from db failed', function(done) {
			implementations = {
				req: {
					get: function(header) {
						return '0001';
					}
				},
				res: {
					status: function(stat) {
						return this;
					},
					send: function() {}
				},
				db: {
					getInfo: function(user, callback) {
						return callback('Error', null);
					}
				},
				config: {
					database: './db'
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				done();
			});
		});

		it('correct, one api_key information available', function(done) {
			implementations = {
				req: {
					get: function(header) {
						return '0001';
					}
				},
				res: {
					json: function(body) {}
				},
				db: {
					getInfo: function(user, callback) {
						return callback(null, [{
							API_KEY: 'api_key',
							organization: 'organization',
							name: 'name',
							version: 1.0
						}]);
					}
				},
				config: {
					database: './db'
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.db.getInfo.callCount, 1);
				assert.equal(spies.req.get.callCount, 1);
				assert.deepEqual(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.deepEqual(spies.db.getInfo.getCall(0).args[0], '0001');
				assert.deepEqual(spies.res.json.getCall(0).args[0], [ { 
					offering: { 
						organization: 'organization',
						name: 'name',
						version: 1
					},
    				API_KEY: 'api_key' } ]);
				done();
			});
		});

		it('correct, two api_keys information available', function(done) {
			implementations = {
				req: {
					get: function(header) {
						return '0001';
					}
				},
				res: {
					json: function(body) {}
				},
				db: {
					getInfo: function(user, callback) {
						return callback(null, [{
							API_KEY: 'api_key1',
							organization: 'organization1',
							name: 'name1',
							version: 1.0
						}, {
							API_KEY: 'api_key2',
							organization: 'organization2',
							name: 'name2',
							version: 1.0
						}]);
					}
				},
				config: {
					database: './db'
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.deepEqual(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.deepEqual(spies.db.getInfo.getCall(0).args[0], '0001');
				assert.deepEqual(spies.res.json.getCall(0).args[0], [ { 
					offering: { 
						organization: 'organization1',
						name: 'name1',
						version: 1
					},
    				API_KEY: 'api_key1' }, {
    					offering: { 
						organization: 'organization2',
						name: 'name2',
						version: 1
					},
    				API_KEY: 'api_key2' 
    				} ]);
				done();
			});
		});
	});

	describe('newResourceHandler', function() {
		var implementations = {
			req: {
				body: {}
			},
			db: {
				getService: function(publicPath, callback) {
					return callback('Error', null);
				}
			},
			config: {
				database: './db'
			},
			url: {
				parse: function(url) {
					return {
						pathname: '/path'
					}
				}
			},
			app: {
				post: function(path, handler) {
					if (path === '/api/resources') {
						return handler(implementations.req, implementations.res);
					} else {
						return;
					}
				}
			}
		}

		it('error (400), incorrect body', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				done();
			});
		});

		it('error (400), no service available', function(done) {
			implementations.req.body = {
				record_type: 'rec_type',
				unit: 'megabyte',
				component_label: 'com_label',
				url: 'http://localhost/path',
				offering: {
					organization: 'org',
					name: 'name',
					version: 1.0
				}
			}
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				done();
			});
		});

		it('error (400), unsupported accounting unit', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getService = function(publicPath, callback) {
				return callback(null, {});
			};
			implementations.config.modules = {
				accounting: {
					indexOf: function(array) {
						return -1;
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.res.send.getCall(0).args[0], 'Unsupported accounting unit.');
				done();
			});
		});

		it('error (400) adding the information to db', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.addResource = function(resource, callback) {
				return callback('Error');
			}
			implementations.config.modules.accounting.indexOf = function(array) {
				return 1;
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.deepEqual(spies.db.addResource.getCall(0).args[0], {
					offering: implementations.req.body.offering,
					publicPath: '/path',
					record_type: implementations.req.body.record_type,
					unit: implementations.req.body.unit,
					component_label: implementations.req.body.component_label
				});
				done();
			});
		});

		it('correct (201), resource added succesfully', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.addResource = function(resource, callback) {
				return callback(null);
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.res.status.getCall(0).args[0], 201);
				assert.deepEqual(spies.db.addResource.getCall(0).args[0], {
					offering: implementations.req.body.offering,
					publicPath: '/path',
					record_type: implementations.req.body.record_type,
					unit: implementations.req.body.unit,
					component_label: implementations.req.body.component_label
				});
				done();
			});
		});
	});

	describe('newBuyHandler', function() {
		var implementations = {
			res: {
				status: function(status) {
					return this;
				},
				send: function() {}
			},
			req: {
				setEncoding: function(encoding) {},
				body: {
					offering: {
						organization: 'org',
						name: 'name',
						version: 1.0
					},
					resources: [{

					}],
					customer: '0001',
					reference: 'ref'
				}
			},
			db: {
				getApiKey: function(user, offer, callback) {
					return callback('Error', null);
				}
			},
			url: {
				parse: function(url) {
					return {
						pathname: '/path'
					}
				}
			},
			config: {
				database: './db'
			},
			app: {
				post: function(path, handler) {
					if (path === '/api/users') {
						return handler(implementations.req, implementations.res);
					} else {
						return;
					}
				}
			}
		}

		it('error (500), error getting the API_KEY form db', function(done) {
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				done();
			});
		});

		it('error (500), error checking the info', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getApiKey = function(user, offer, callback) {
				return callback(null, null);
			}
			implementations.db.checkBuy = function(api_key, publicPath, callback) {
				return callback('Error', null);
			}
			implementations.async = {
				each: function(list, handler, callback) {
					for (var i = 0; i < list.length; i++) {
						handler(list[i], function(param) {
							if (i == list.length - 1) {
								return callback(param);
							}
						});
					}
					if (list.length == 0) {
						return callback();
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				done();
			});
		});

		it('error (500), error getting the unit', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.checkBuy = function(api_key, publicPath, callback) {
				return callback(null, false);
			}
			implementations.db.getUnit = function(path, organization, name, version, callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				done();
			});
		});
		
		it('error (400), wrong path in the offer', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getUnit = function(path, organization, name, version, callback) {
				return callback(null, null);
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				done();
			});
		});

		it('error(500), error getting the service', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getUnit = function(path, organization, name, version, callback) {
				return callback(null, 'megabyte');
			}
			implementations.db.getService = function(path, callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				done();
			});
		});

		it('error (400), error adding the accounting information', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getService = function(path, callback) {
				return callback(null, {
					url: 'http://localhost',
					port: 9010
				});
			}
			implementations.db.addInfo = function(api_key, accounting_info, callback) {
				return callback('Error');
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.db.addInfo.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b' );
				assert.deepEqual(spies.db.addInfo.getCall(0).args[1], {
			        accounting: {
			          	"/path": {
				            correlation_number: 0,
				            num: 0,
				            port: 9010,
				            unit: "megabyte",
				            url: "http://localhost"
			          	}
			        },
			        actorID: "0001",
			        name: "name",
			       	organization: "org",
			        reference: "ref",
			        version: 1
				});
				done();
			});
		});

		it('correct (201), offer not bought', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getService = function(path, callback) {
				return callback(null, {
					url: 'http://localhost',
					port: 9010
				});
			}
			implementations.db.addInfo = function(api_key, accounting_info, callback) {
				return callback(null);
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 201);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.db.addInfo.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b' );
				assert.deepEqual(spies.db.addInfo.getCall(0).args[1], {
			        accounting: {
			          	"/path": {
				            correlation_number: 0,
				            num: 0,
				            port: 9010,
				            unit: "megabyte",
				            url: "http://localhost"
			          	}
			        },
			        actorID: "0001",
			        name: "name",
			       	organization: "org",
			        reference: "ref",
			        version: 1
				});
				done();
			});
		});

		it('error (400), error getting the information from an offer already bought', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.checkBuy = function(api_key, path, callback) {
				return callback(null, true);
			}
			implementations.db.getNotificationInfo = function(api_key, path, callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.db.getNotificationInfo.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.db.getNotificationInfo.getCall(0).args[0], 
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.getNotificationInfo.getCall(0).args[1], '/path'); 
				done();
			});
		});
		
		it('correct (201), offer already bought', function(done) {
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			implementations.db.getNotificationInfo = function(api_key, path, callback) {
				return callback(null, {
					num: 1.3,
					correlation_number: 0002,
					unit: 'megabyte'
				});
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.db.checkBuy.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.db.getNotificationInfo.callCount, 1);
				assert.equal(spies.req.setEncoding.getCall(0).args[0], 'utf-8');
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001');
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], implementations.req.body.offering);
				assert.equal(spies.res.status.getCall(0).args[0], 201);
				assert.equal(spies.db.checkBuy.getCall(0).args[0],
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.checkBuy.getCall(0).args[1], '/path' );
				assert.equal(spies.db.getUnit.getCall(0).args[0], '/path');
				assert.equal(spies.db.getUnit.getCall(0).args[1], 'org');
				assert.equal(spies.db.getUnit.getCall(0).args[2], 'name');
				assert.equal(spies.db.getUnit.getCall(0).args[3], 1);
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.db.getNotificationInfo.getCall(0).args[0], 
					'46ac43d8c7d9a9c8cb65f7e81e0477b0f6c6a03b');
				assert.equal(spies.db.getNotificationInfo.getCall(0).args[1], '/path'); 
				done();
			});
		});

		it('correct (201), api_key already generated', function(done) {
			implementations.db.getApiKey = function(user, offer, callback) {
				return callback(null, 'api_key');
			}
			implementations.req.setEncoding = function(type_encoding) {};
			implementations.res = {
				status: function(stat) {
					return this;
				},
				send: function() {}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.setEncoding.callCount, 1);
				assert.equal(spies.db.getApiKey.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 201);
				assert.equal(spies.db.getApiKey.getCall(0).args[0], '0001'); 
				assert.deepEqual(spies.db.getApiKey.getCall(0).args[1], { 
					organization: 'org', 
					name: 'name', 
					version: 1 
				});
				done();
			});
		});
	});
});
