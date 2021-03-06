var config = {};

// Accounting proxy configuration
//--------------------------------------------------
// Configures the address and ports for the accounting proxy
config.accounting_proxy = {

        /**
         * Port where the accounting proxy server is listening.
         */
        port: 9000,

        /**
        * Por where the accounting proxied is listening the Store notifications
        */
        store_port: 9001

};

// Accounting database configuration
//--------------------------------------------------
// Select the database. Possible optrions are: 
//  * './db_Redis': redis database
//  * './db': sqlite database
config.database = './db';

config.database_name = 'accountingDB.sqlite';

// Accouning Modules configuration
//--------------------------------------------------
// Configures the accounting modules used by the accounting proxy
config.modules = {

    accounting: [ 'call', 'megabyte']

};


// WStore sonfiguration
//--------------------------------------------------
// Configures the WStore address and port
config.WStore = {

    /** 
    * WStore host
    */
    accounting_host: 'localhost',

    /** 
    * WStore path for accounting notifications
    */
    accounting_path: '/api/contracting/',

    /** 
    * WStore port
    */
    accounting_port: 9010

};

// Resource configuration
//--------------------------------------------------
// Configures the resources accounted by the proxy
config.resources = {

    /* *
    * Enabled if the resource accounted is Orion Context Broker
    */
    contextBroker: false,

    /* *
    * Port where the accounting proxy server is listening to subscription notifications
    */
    notification_port: 9002

};

module.exports = config;