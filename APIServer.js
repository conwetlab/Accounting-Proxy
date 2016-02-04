var express = require('express'),
    crypto = require('crypto'),
    url = require('url'),
    config = require('./config'),
    bodyParser = require('body-parser'),
    async = require('async'),
    winston = require('winston');
    validation = require('./validation');
var db = require(config.database);
var app = express();
var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'debug',
            filename: './logs/all-log',
            colorize: false
        }),
        new winston.transports.Console({
            level: 'info',
            colorize: true
        })
    ],
    exitOnError: false
});

"use strict";

exports.run = function(){
    app.listen(app.get('port'));
};

var newResourceHandler = function(req, res) {
    logger.log('debug', "New resource notification recieved");

    if (! req.is('application/json')) {
        res.status(415).json({error: 'Content-Type must be "application/json"'});
    } else {
        validation.validate('resource', req.body, function(err) { // Validate the request body
            if (err) {
                res.status(400).json({error: 'Invalid json'});
            } else {
                req.setEncoding('utf-8')
                body = req.body;
                var publicPath = url.parse(body.url).pathname;
                db.getService(publicPath, function(err, data) {
                    if ( data === null || err !== null) {
                        res.status(400).json({error: 'Invalid path in the url specified in the body'});
                    } else {
                        if (config.modules.accounting.indexOf(body.unit) === -1) {
                            res.status(400).json({ error: 'Unsupported accounting unit' });
                        } else {
                            db.addResource({
                                offering: body.offering,
                                publicPath: publicPath,
                                record_type: body.record_type,
                                unit: body.unit,
                                component_label: body.component_label
                            }, function(err) {
                                if (err) {
                                    res.status(400).send();
                                } else {
                                    res.status(201).send();
                                }
                            });
                        }
                    }
                });
            }
        });
    }
};

var newBuyHandler = function(req, res){
    logger.log('debug', "WStore notification recieved");

    if (! req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be "application/json"'});
    } else {
        validation.validate('offer', req.body, function(err) { // Validate the request body
            if (err) {
                res.status(400).send({error: 'Invalid json'});
            } else {
                req.setEncoding('utf-8');
                body = req.body;

                var offer = body.offering,
                    resrc = body.resources,
                    user  = body.customer,
                    ref   = body.reference,
                    accounting_info = {};
                db.getApiKey(user, offer, function(err, api_key) {
                    if (err) {
                        logger.warn('Error getting the api_key')
                        res.status(500).send();
                    } else if (api_key === null) {
                        // Generate API_KEY
                        generateHash([user, offer.organization, offer.name, offer.version], function(id) {
                            api_key = id;

                            accounting_info[api_key] = {
                                actorID: user,
                                organization: offer.organization,
                                name: offer.name,
                                version: offer.version,
                                accounting: {},
                                reference: ref
                            }
                            async.each(resrc, function(resource, task_callback) {
                                var publicPath = url.parse(resource.url).pathname;
                                db.checkBuy(api_key, publicPath, function(err, bought) { // Check if the user already has bought the resource
                                    if (err) {
                                        task_callback('Error in db');
                                    } else {
                                        db.getUnit(publicPath, offer.organization, offer.name, offer.version, function(err, unit) {
                                            if (err) {
                                                task_callback('Error in db');
                                            } else if (unit === null ){ // Incorrect service
                                                task_callback('Wrong path in the offer'); // If one path in the offer is wrong, send 400
                                            } else {
                                                db.getService(publicPath, function(err, service) {
                                                    if (err) {
                                                        task_callback('Error in db');
                                                    } else {
                                                        if (! bought) { // New resource for the client
                                                            accounting_info[api_key].accounting[publicPath] = {
                                                                url: service.url,
                                                                port: service.port,
                                                                num: 0,
                                                                correlation_number: 0,
                                                                unit: unit
                                                            };
                                                            task_callback(null);
                                                        } else { // Already bought 
                                                            db.getNotificationInfo(api_key, publicPath, function(err, info) {
                                                                if (err) {
                                                                    task_callback('Error in db');
                                                                } else {
                                                                    accounting_info[api_key].accounting[publicPath] = {
                                                                        url: service.url,
                                                                        port: service.port,
                                                                        num: info.num,
                                                                        correlation_number: info.correlation_number,
                                                                        unit: unit
                                                                    }
                                                                    task_callback(null);
                                                                }
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }, function(err) {
                                if (err == 'Wrong path in the offer') {
                                    logger.log('debug', "%s", err);
                                    res.status(400).json({error: 'Invalid path in the resource'}); // Wrong path in the offer
                                } else if (err) {
                                    res.status(500).send(); // Internal server error 
                                } else {
                                    db.addInfo(api_key, accounting_info[api_key], function(err) { // Save the information in db 
                                        if (err) {
                                            res.status(400).send();
                                        } else {
                                            res.status(201).send();
                                        }
                                    });
                                }
                            });
                        });
                    } else {
                        res.status(201).send();
                    }
                });
            }
        })
    }
};

var keysHandler = function(req, res){
    var userID = req.get('X-Actor-ID');

    if (userID === undefined) {
        res.status(400).json({error: 'Header "X-Actor-ID" missed'});
    } else {
        db.getInfo(userID, function(err, data) {
            if (err != undefined || data.length == 0) {
                res.status(400).json({ error: 'No data available for that user'});
            } else {
                var result = [];
                async.each(data, function(entry, task_callback) {
                    result.push({
                        offering: {
                            organization: entry.organization,
                            name: entry.name,
                            version: entry.version
                        },
                        API_KEY: entry.API_KEY
                    });
                    task_callback();
                }, function() {
                    res.json(result);
                });
            }
        });
    }
};

var generateHash = function(args, callback) {
    var string,
        counter = args.length;

    for (i in args) {
        counter--;
        string += args[i];
        if (counter == 0) {
            var sha1 = crypto.createHash('sha1');
            sha1.update(string);
            var id = sha1.digest('hex');
            return callback(id);
        }
    }
}

app.set('port', config.accounting_proxy.store_port);
app.use(bodyParser.json());

app.post('/api/resources', newResourceHandler);
app.post('/api/users', newBuyHandler);
app.get('/api/users/keys', keysHandler);
module.exports.app = app;