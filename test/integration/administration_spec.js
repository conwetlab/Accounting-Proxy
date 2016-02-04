var request = require('supertest'),
	assert = require('assert'),
	api = require('../../APIServer'),
	proxyquire = require('proxyquire'),
	api_server,
	db_mock,
	redis_mock = require('fakeredis');

var mock_config = {
	database: './db_Redis'
}

var resource = {
    offering: {
        organization: "aa",
        name: "bb",
        version: "1"
    },
    provider: "provider1",
    name: "resource2",
    version: "1.0",
    content_type:"application/json",
    url: "http://www.resource2.org/public",
    record_type: "event",
    unit: "call",
    component_label: "callusage"
}

var offer = {
	offering: {
		organization: "aa",
		name: "bb",
		version: "1"
	},
	reference: "000000000000002",
	customer: '0001',
	customer_name: 'user1',
	resources: [
		{
			provider: "provider1",
			name: "resource2",
			version: "1.0",
			content_type:"application/json",
			url: "http://www.resource2.org/public"
		}
	]
}

describe('Testing the administration API', function(done) {

	describe('[POST: /api/resources] newResource request', function() {

		beforeEach(function() { // Mock the database
			db_mock = proxyquire('../../db_Redis', {
				'redis': redis_mock
			});

			api_server = proxyquire('../../APIServer', {
				'./config': mock_config,
				'./db_Redis': db_mock
			});
		});

		it('error (415) no json content-type', function(done) {
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'text/html')
				.expect(415, done);
		});

		it('error (400) invalid body (undefined unit)', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			this.resource.unit = undefined;
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(400, done);
		});

		it('error (400) invalid body (wrong path)', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			this.resource.url = "http://www.resource2.org/no_exist"
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(400, done);
		});

		it('error (400) invalid body (undefined component_label)', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			this.resource.component_label = undefined;
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(400, done);
		});

		it('error (400) invalid body (undefined url)', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			this.resource.url = undefined;
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(400, done);
		});

		it('error (400) unsupported accounting unit', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			this.resource.unit = 'no_exist';
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(400, done);
		});

		it('error (400) invalid body (no offering)', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			this.resource.offering = undefined;
			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(400, done);
		});

		it('correct (201) successfully created', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));
			db_mock.newService('/public', 'http://localhost/private', 9010, function(err) {
				if (err) {
					console.log('Error creating new service');
					process.exit(1);
				}
			});

			request(api_server.app)
				.post('/api/resources')
				.set('content-type', 'application/json')
				.send(this.resource)
				.expect(201, done);
		});

	});

	describe('[POST: /api/users] newBuy request', function() {

		beforeEach(function() {
			db_mock = proxyquire('../../db_Redis', {
				'redis': redis_mock
			});

			api_server = proxyquire('../../APIServer', {
				'./config': mock_config,
				'./db_Redis': db_mock
			});
		});

		it('error (415) no json content-type', function(done) {
			this.offer = JSON.parse(JSON.stringify(offer));
			request(api_server.app)
				.post('/api/users')
				.set('content-type', 'text/html')
				.send(JSON.stringify(this.offer))
				.expect(415, done);
		});

		it('error (400) invalid path in the offer', function(done) {
			this.offer = JSON.parse(JSON.stringify(offer));
			this.offer.resources[0].url = 'http://localhost/no_exist'

			request(api_server.app)
				.post('/api/users')
				.set('content-type', 'application/json')
				.send(JSON.stringify(this.offer))
				.expect(400, { error: 'Invalid path in the resource' }, done);
		});

		it('error (400) invalid body', function(done) {
			request(api_server.app)
				.post('/api/users')
				.set('content-type', 'application/json')
				.send(JSON.stringify({}))
				.expect(400, { error: 'Invalid json' }, done);
		});

		it('correct (201) offer already bought', function(done) {
			this.offer = JSON.parse(JSON.stringify(offer));
			db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd051', {
				actorID: '0001',
				organization: this.offer.offering.organization,
				name: this.offer.offering.name,
				version: this.offer.offering.version,
				accounting: {
					'/public' : {
						url: 'http://localhost/private',
						port: 9010,
						num: 0,
						correlation_number: 0,
						unit: 'megabyte'
					}
				},
				reference: 'ref'
			}, function(err) {
				if (err) {
					console.log('Error adding resource');
					process.exit(1);
				}
			});

			request(api_server.app)
				.post('/api/users')
				.set('content-type', 'application/json')
				.send(JSON.stringify(this.offer))
				.expect(201, done);
		});

		it('correct (201) new buy', function(done) {
			this.offer = JSON.parse(JSON.stringify(offer));
			db_mock.newService('/public', 'http://localhost/private', 9010, function(err) {
				if (err) {
					console.log('Error creating new service');
					process.exit(1);
				}
			});
			db_mock.addResource( {
				offering: this.offer.offering,
				publicPath: '/public',
				record_type: resource.record_type,
				unit: resource.unit,
				component_label: resource.component_label
			}, function(err) {
				if (err) {
					console.log('Error adding resource');
					process.exit(1);
				}
			});

			request(api_server.app)
				.post('/api/users')
				.set('content-type', 'application/json')
				.send(JSON.stringify(this.offer))
				.expect(201, {}, done);
		});
	});

	describe('[GET: /api/users/keys] get ApiKeys request', function() {

		beforeEach(function() {
			db_mock = proxyquire('../../db_Redis', {
				'redis': redis_mock
			});

			api_server = proxyquire('../../APIServer', {
				'./config': mock_config,
				'./db_Redis': db_mock
			});
		});

		it('error (400) "X-Actor-ID" header missed', function(done) {
			request(api_server.app)
				.get('/api/users/keys')
				.expect(400, {error: 'Header "X-Actor-ID" missed'}, done);
		});

		it('error (400) wrong user', function(done) {
			request(api_server.app)
				.get('/api/users/keys')
				.set('X-Actor-ID', 'wrong')
				.expect(400, {error: 'No data available for that user'}, done);
		});

		it('correct (200) one api_key', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));

			db_mock.addResource( {
				offering: this.resource.offering,
				publicPath: '/public',
				unit: this.resource.unit,
				component_label: this.resource.component_label
			}, function(err) {
				if (err) {
					console.log('Error adding resource');
					process.exit(1);
				}
			});
			db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd051', {
				actorID: '0001',
				organization: this.resource.offering.organization,
				name: this.resource.offering.name,
				version: this.resource.offering.version,
				accounting: {
					'/public' : {
						url: 'http://localhost/private',
						port: 9010,
						num: 0,
						correlation_number: 0,
						unit: 'megabyte'
					}
				},
				reference: 'ref'
			}, function(err) {
				if (err) {
					console.log('Error adding the accounting information');
					process.exit(1);
				}
			});
			request(api_server.app)
				.get('/api/users/keys')
				.set('X-Actor-ID', '0001')
				.expect(200, 
					[ { offering: { organization: 'aa', name: 'bb', version: '1' },
    					API_KEY: 'aa610c1ee9b2c9e1295f32a9a45dd992851fd051' } ],
     				done);
		});

		it('correct (200) two api_keys', function(done) {
			this.resource = JSON.parse(JSON.stringify(resource));

			db_mock.addResource( {
				offering: this.resource.offering,
				publicPath: '/public',
				unit: this.resource.unit,
				component_label: this.resource.component_label
			}, function(err) {
				if (err) {
					console.log('Error adding resource');
					process.exit(1);
				}
			});
			db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd051', {
				actorID: '0001',
				organization: this.resource.offering.organization,
				name: this.resource.offering.name,
				version: this.resource.offering.version,
				accounting: {
					'/public' : {
						url: 'http://localhost/private',
						port: 9010,
						num: 0,
						correlation_number: 0,
						unit: 'megabyte'
					}
				},
				reference: 'ref'
			}, function(err) {
				if (err) {
					console.log('Error adding the accounting information');
					process.exit(1);
				}
			});
			db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd052', {
				actorID: '0001',
				organization: this.resource.offering.organization,
				name: this.resource.offering.name,
				version: this.resource.offering.version,
				accounting: {
					'/public2' : {
						url: 'http://localhost/private',
						port: 9010,
						num: 0,
						correlation_number: 0,
						unit: 'megabyte'
					}
				},
				reference: 'ref'
			}, function(err) {
				if (err) {
					console.log('Error adding the accounting information');
					process.exit(1);
				}
			});

			request(api_server.app)
				.get('/api/users/keys')
				.set('X-Actor-ID', '0001')
				.expect(200, [ 
					{ offering: { organization: 'aa', name: 'bb', version: '1' },
    					API_KEY: 'aa610c1ee9b2c9e1295f32a9a45dd992851fd051' },
  					{ offering: { organization: 'aa', name: 'bb', version: '1' },
    					API_KEY: 'aa610c1ee9b2c9e1295f32a9a45dd992851fd052' } ], done);
		});
	});
});