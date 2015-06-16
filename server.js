'use strict';

var express = require('express'), app = express();
var HttpStatus = require('http-status-codes');

app.use(require('./controllers'));
app.use(errorHandler);

var PORT = 8080;

function errorHandler(err, req, res, next) {
    console.error(err.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR);
    res.contentType = 'application/json';
    // TODO: in production mode don't send stack trace
    res.send({error: err.message, stacktrace: err.stack});
}

app.listen(PORT, function() {
    console.log('Running on http://localhost:' + PORT);
});
