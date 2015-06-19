var express = require('express');
var config = require('./config.json');
var proxy = require('./HTTP_Client/HTTPClient.js');
var db = require('./db.js');
var api = require('./APIServer.js');
var notifier = require('./notifier.js');
var cron = require('node-schedule');

var app = express();

var map = {};

app.set('port', 9000);

app.use(function(request, response, next) {
    var data = '';
    // Receive data
    request.on('data', function(d) {
        data += d;
    });
    // Finish receiving data
    request.on('end', function() {
        request.body = data;
        next();
    });
});

app.use(function(request, response) {
    var userID = request.get('X-Actor-ID');
    var API_KEY = request.get('X-API-KEY');
    var publicPath = request.path;

    if (userID === undefined) {
        console.log("[LOG] Undefined username");
        response.status(400).end();
    }

    if (API_KEY === undefined) {
        console.log("[LOG] Undefined API_KEY");
        response.status(400).end();
    }

    if (map[API_KEY] !== undefined) {
        var info = map[API_KEY];

        if (info.actorID === userID) {
            var accounting = info.accounting[publicPath];

            if (accounting !== undefined) {
                var options = {
                    host: 'localhost',
                    port: accounting.port,
                    path: accounting.privatePath,
                    method: request.method,
                    headers: proxy.getClientIp(request, request.headers)
                };

                proxy.sendData('http', options, request.body, response, function(status, resp, headers) {
                    response.statusCode = status;
                    for(var idx in headers)
                        response.setHeader(idx, headers[idx]);
                    response.send(resp);
                    accounting.num++;
                    db.count(userID, API_KEY, publicPath, 1);
                });
            } else {
                console.log("[LOG] Invalid resurce");
                response.status(404).end();
            }
        } else {
            console.log("[LOG] user has not access");
            response.status(401).end();
        }
    } else {
        console.log("[LOG] Invalid API_KEY");
        response.status(400).end();
    }
});

exports.newUser = function(user, apiKey, paths) {

    // Add user if not exist.
    if (users[apiKey] === undefined)
        console.log("New user found!!");
        users[apiKey] = {
            API_KEY: api,
            id: user,
            num: 0
        };

    // Add user to paths
    for (var i in paths) {
        var found = false;
        for (var j in map[paths[i].publicPath].users) {
            if (map[paths[i].publicPath].users[j].id === user &&
                map[paths[i].publicPath].users[j].API_KEY === apiKey) {
                found = true;
                break;
            }
        }
        if (!found)
            map[paths[i].publicPath].users.push(users[apiKey]);
    }

    // console.log(JSON.stringify(map, null, 2));
};

db.init();

db.loadFromDB(function(err, data) {
    if (err)
        console.log('Something went wrong');
    else {
        map = data;
        if (Object.getOwnPropertyNames(data).length === 0)
            console.log("[LOG] No data avaliable");
        else {
            // console.log(map);
            console.log(JSON.stringify(map, null, 2));
            // TODO: Notify pending accounting
        }
        app.listen(app.get('port'));
        // Start API Server
        api.run();
    }
});

/* Create daemon to update WStore every day */
/* Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 * DEPRECATED
 */
var job = cron.scheduleJob('00 00 * * *', function() {
    console.log('[LOG] Sending accounting information...');
    // variable i is unused in this invocation.
    for (userID in map) {
        notifier.notify(0, map[userID], userID, function(i, user_id, requests, correlation_number) {
            map[user_id].requests = requests;
            map[user_id].correlation_number = correlation_number;
        });
    }
});
