var sqlite = require('sqlite3').verbose(); // Debug enable
var async = require('async');

var db = new sqlite.Database('accountingDB.sqlite');

exports.init = function() {

    db.serialize(function() {
        db.run('PRAGMA encoding = "UTF-8";');
        db.run('PRAGMA foreign_keys = 1;');
        db.run('CREATE TABLE IF NOT EXISTS servicies ( \
                    privatePath     TEXT, \
                    port            TEXT, \
                    PRIMARY KEY(privatePath, port) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS public ( \
                    publicPath     TEXT, \
                    privatePath    TEXT, \
                    port           TEXT, \
                    PRIMARY KEY (publicPath), \
                    FOREIGN KEY (privatePath, port) REFERENCES servicies (privatePath, port) ON UPDATE CASCADE \
               )');

        db.run('CREATE TABLE IF NOT EXISTS resources ( \
                    provider        TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    content_type    TEXT, \
                    privatePath     TEXT, \
                    port            TEXT, \
                    PRIMARY KEY (provider, name, version), \
                    FOREIGN KEY (privatePath, port) REFERENCES servicies (privatePath, port) ON UPDATE CASCADE \
               )');
        db.run('CREATE TABLE IF NOT EXISTS offers ( \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    PRIMARY KEY (organization, name, version) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerResource ( \
                    provider        TEXT, \
                    resourceName    TEXT, \
                    resourceVersion TEXT, \
                    organization    TEXT, \
                    offerName       TEXT, \
                    offerVersion    TEXT, \
                    PRIMARY KEY (provider, resourceName, resourceVersion, organization, offerName, offerVersion), \
                    FOREIGN KEY (provider, resourceName, resourceVersion) REFERENCES resources (provider, name, version), \
                    FOREIGN KEY (organization, offerName, offerVersion) REFERENCES offers (organization, name, version) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS accounts ( \
                    actorID         TEXT, \
                    PRIMARY KEY (actorID) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerAccount ( \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    actorID         TEXT, \
                    API_KEY         TEXT, \
                    reference       TEXT, \
                    PRIMARY KEY (organization, name, version, actorID), \
                    FOREIGN KEY (organization, name, version) REFERENCES offers (organization, name, version), \
                    FOREIGN KEY (actorID) REFERENCES accounts (actorID) \
               )');
        db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    actorID         TEXT, \
                    provider        TEXT, \
                    resourceName    TEXT, \
                    resourceVersion TEXT, \
                    organization    TEXT, \
                    offerName       TEXT, \
                    offerVersion    TEXT, \
                    num             INT,  \
                    PRIMARY KEY (actorID, provider, resourceName, resourceVersion, organization, offerName, offerVersion), \
                    FOREIGN KEY (provider, resourceName, resourceVersion) REFERENCES resources (provider, name, version), \
                    FOREIGN KEY (organization, offerName, offerVersion) REFERENCES offers (organization, name, version) \
               )');
        });
}

exports.loadFromDB = function(setData) {
    var data = {};
    db.all('SELECT servicies.privatePath, servicies.port, public.publicPath \
            FROM servicies \
            INNER JOIN public \
            WHERE public.privatePath=servicies.privatePath AND public.port=servicies.port',
            function(err, row) {
                var counter = row.length;
                if (row.length !== 0)
                    for (i in row) {
                        loadUsers(data, row[i], function() {
                            counter--;
                            if (counter === 0)
                                setData(null, data);
                        });
                    }
                else
                    setData(null, data);
            }
    );
}

function loadUsers(data, row, callback) {
    db.all('SELECT offerAccount.actorID, API_KEY, accounting.num \
            FROM offerAccount, accounting \
            WHERE EXISTS ( \
              SELECT organization, offerName, offerVersion \
              FROM offerResource \
              WHERE offerAccount.organization=offerResource.organization AND offerAccount.name=offerResource.offerName AND \
                    offerAccount.version=offerResource.offerVersion AND EXISTS ( \
                SELECT provider, name, version \
                FROM resources \
                WHERE offerResource.provider=provider AND offerResource.resourceName=name AND \
                      offerResource.resourceVersion=version AND privatePath=$privatePath AND port=$port AND EXISTS ( \
                  SELECT actorID, provider, resourceName, resourceVersion, organization, offerName, offerVersion, num \
                  FROM accounting \
                  WHERE resources.provider=accounting.provider AND resources.name=accounting.resourceName AND \
                    resources.version=accounting.resourceVersion AND accounting.organization=offerAccount.organization AND \
                    accounting.offerName=offerAccount.name AND accounting.offerVersion=offerAccount.version AND \
                    accounting.actorID=offerAccount.actorID \
                  ) \
                ) \
              ) \
            GROUP BY API_KEY',
            { $privatePath: row.privatePath, $port: row.port },
            function(err, row2) {
                var id = row.publicPath;
                if (data[id] === undefined) {
                    data[id] =  {
                        path: row.privatePath,
                        port: row.port,
                        users: []
                    };
                }
                for (j in row2) {
                    data[id].users.push({
                        id: row2[j].actorID,
                        API_KEY: row2[j].API_KEY,
                        num: row2[j].num
                    });
                }
                callback();
            }
    );
}

exports.checkRequest = function(actorID, publicPath, callback) {
    db.all('SELECT privatePath, port \
            FROM public \
            WHERE publicPath=$publicPath AND EXISTS ( \
              SELECT privatePath, port \
              FROM resources \
              WHERE public.privatePath=privatePath AND public.port=port AND EXISTS ( \
                SELECT provider, resourceName, resourceVersion, organization, offerName, offerVersion \
                FROM offerResource \
                WHERE resources.provider=provider AND resources.name=resourceName AND resources.version=resourceVersion AND EXISTS ( \
                  SELECT organization, name, version \
                  FROM offerAccount \
                  WHERE actorID=$actorID AND offerResource.organization=organization AND offerResource.offerName=name AND offerResource.offerVersion=version)))',
        {$actorID: actorID, $publicPath: publicPath}, function(error, row) {
            if (row.length === 1)
                callback(null, row[0].privatePath, row[0].port);
            else
                callback("User doesn't have access", null, null);
    });
}

exports.count = function(actorID, privatePath, port) {
    db.run('UPDATE accounting \
            SET num=num+1 \
            WHERE actorID=$actorID AND EXISTS ( \
              SELECT provider, name, version, privatePath, port \
              FROM resources \
              WHERE accounting.provider=provider AND accounting.resourceName=name AND accounting.resourceVersion=version AND \
                    resources.privatePath=$privatePath AND resources.port=$port AND EXISTS ( \
                SELECT organization, offerName, offerVersion, provider, resourceName, resourceVersion \
                FROM offerResource \
                WHERE accounting.organization=organization AND accounting.offerName=offerName AND accounting.offerVersion=offerVersion \
                      AND resources.provider=provider AND resources.name=resourceName AND resources.version = resourceVersion))',
        {
            $actorID: actorID,
            $privatePath: privatePath,
            $port: port
        });
}