/**
 * GAIA result upload service. It receives files containing measures that need to be processed and pushed to metrics API. The files
 * must be in format supported by GAIA result processors. The file is information discovered from external system - through REST API
 * or as an event.
 */
'use strict';

var log4js = require('log4js');
// replaces console.log function with log4j
log4js.replaceConsole();

var express = require('express'), app = express();
var HttpStatus = require('http-status-codes');
var notification = require('./controllers/notification');
var when = require('when');
var auth = require('./middlewares/auth');

var PORT = 8080;

var logger = log4js.getLogger('server.js');

exitOnSignal('SIGINT');
exitOnSignal('SIGTERM');

// TODO: use grace or other module for graceful shutdown (close sockets etc) - not easy as we need to exec async code in multiple modules
function exitOnSignal(signal) {
    process.on(signal, function() {
        logger.debug('Caught ' + signal + ', exiting');
        process.exit(1);
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
    when.all([notification.initAmq()]).then(function() {
        app.listen(PORT, function() {
            logger.info('Running on http://localhost:' + PORT);
        });
    }, function(err) {
        logger.error('Result upload service initialization failure');
        logger.error(err.stack);
        process.exit(1);
    });
}

initServer();
