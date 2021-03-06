/**
 * Authentication handling module. Contains code to integrate authentication into express library.
 * @module middlewares/auth
 */
'use strict';

var log4js = require('log4js');
var oauthserver = require('oauth2-server');
var request = require('request');
var VError = require('verror');

var logger = log4js.getLogger('auth.js');

/**
 * Returns URI where security token can be checked
 *
 * @returns {string}
 */
function getAuthCheckUri() {
    if (!process.env.AUTH_SERVER) {
        throw new Error('AUTH_SERVER environment variable is not specified');
    }
    return 'http://' + process.env.AUTH_SERVER + '/sts/oauth/check_token';
}

/**
 * Gets full access token for given bearer token. The access token holds additional information needed by application
 * or the oauth2-server library.
 *
 * @param bearerToken {string} OAuth bearer token
 * @param callback
 */
function getOAuthAccessToken(bearerToken, callback) {
    var options = {
        uri: getAuthCheckUri(),
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        qs: {token: bearerToken}
    };
    request(options, function(err, response, body) {
        if (err) {
            callback(new VError(err, 'Failed to verify bearer token due to error')); // use VError since this gets logged by oauth2server
        } else {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                var responseObject = JSON.parse(body);
                callback(false, {accessToken: bearerToken, expires: null, tenantId: responseObject.tenantId});
            } else {
                logger.debug('Unauthorized token \'' + bearerToken + '\', status code '+ response.statusCode);
                logger.debug(body);
                callback();
            }
        }
    });
}

var oauth = oauthserver({
  model: {getAccessToken: getOAuthAccessToken},
  grants: [], // we don't provider access tokens, just verify
  debug: logger.error.bind(logger) // used by oauth2server to log errors
});

/** Express authorization handler. To be registered in express application. */
exports.authorise = oauth.authorise();
/**
 * Express error handler. Responsible for returning proper error responses in case of authentication failure. To be registered in express application.
 */
exports.errorHandler = oauth.errorHandler();
