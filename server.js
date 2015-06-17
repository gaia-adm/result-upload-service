'use strict';

var express = require('express'), app = express();
var HttpStatus = require('http-status-codes');
var notification = require('./controllers/notification');
var when = require('when');
var auth = require('./middlewares/auth');

var PORT = 8080;

exitOnSignal('SIGINT');
exitOnSignal('SIGTERM');

// TODO: use grace or other module for graceful shutdown (close sockets etc) - not easy as we need to exec async code in multiple modules
function exitOnSignal(signal) {
    process.on(signal, function() {
        console.log('Caught ' + signal + ', exiting');
        process.exit(1);
    });
}

app.use(auth.authorise);
app.use(require('./controllers'));
app.use(auth.errorHandler);
app.use(expressErrorHandler);

function expressErrorHandler(err, req, res, next) {
    console.error('Unhandled exception in REST call \'' + req.path + '\'');
    console.error(err.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR);
    res.contentType = 'application/json';
    // TODO: in production mode don't send stack trace
    res.send({error: err.message, stacktrace: err.stack});
}

// add any async initializations here
when.all([notification.initAmq()]).then(function() {
    app.listen(PORT, function() {
        console.log('Running on http://localhost:' + PORT);
    });
}, function(err) {
    console.error('Result upload service initialization failure');
    console.error(err.stack);
    process.exit(1);
});
