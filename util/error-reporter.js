/**
 * Module for reporting errors via HTTP
 * @module util/error-reporter
 */
'use strict';

var HttpStatus = require('http-status-codes');

/**
 * Sends HTTP 500 response to client with error details.
 *
 * @param res express result object
 * @param err error instance
 */
function reportError(res, err) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR);
    var response = {error: err.message};
    if (process.env.REST_STACKTRACE) {
        response.stacktrace = err.stack;
    }
    res.json(response);
}

exports.reportError = reportError;
