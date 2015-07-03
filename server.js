/**
 * GAIA result upload service. It receives files containing measures that need to be processed and pushed to metrics API. The files
 * must be in format supported by GAIA result processors. The file is information discovered from external system - through REST API
 * or as an event.
 */
'use strict';

var log4js = require('log4js');
// replaces console.log function with log4j
log4js.replaceConsole();
var logger = log4js.getLogger('server.js');

var grace = require('grace');
var express = require('express'), app = express();
var HttpStatus = require('http-status-codes');
var notification = require('./controllers/notification');
var when = require('when');
var auth = require('./middlewares/auth');

var PORT = 8080;

var graceApp = grace.create();

exitOnSignal('SIGINT');
exitOnSignal('SIGTERM');

function exitOnSignal(signal) {
    process.on(signal, function() {
        logger.debug('Caught ' + signal + ', exiting');
        graceApp.shutdown(1);
    });
}

app.use(auth.authorise);
app.use(require('./controllers'));
app.use(auth.errorHandler);
app.use(defaultErrorHandler);

/**
 * Default error handler for REST. Receives errors not caught by route handler.
 *
 * @param err instance of error
 * @param req express request
 * @param res express response
 */
function defaultErrorHandler(err, req, res) {
    logger.error('Unhandled exception in REST call \'' + req.path + '\'');
    logger.error(err.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR);
    res.contentType = 'application/json';
    // TODO: in production mode don't send stack trace
    res.send({error: err.message, stacktrace: err.stack});
}

/**
 * Initializes the server. Initializes any dependencies first before starting to listen on server socket.
 */
function initServer() {
    // add any async initializations here
    when.all([notification.initAmq()]).done(function onOk() {
        app.listen(PORT, function() {
            logger.info('Running on http://localhost:' + PORT);
        });
    }, function onError(err) {
        logger.error('Result upload service initialization failure');
        logger.error(err.stack);
        graceApp.shutdown(1);
    });
}

graceApp.on('start', function () {
    initServer();
});

graceApp.on('error', function(err){
    console.error(err);
});

graceApp.on('shutdown', function(cb) {
    notification.shutdown().done(function onOk() {
        cb();
    }, function onFailed(err) {
        cb(err);
    });
});

graceApp.on ('exit', function(code){
    logger.debug('Exiting with code ' + code);
});

graceApp.start();
