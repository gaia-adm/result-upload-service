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
    var port = process.env.AUTH_PORT || 8080;
    return 'http://authserver:' + port + '/sts/oauth/check_token';
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
            logger.error(err.stack);
            callback(new VError(err, 'Failed to verify bearer token due to error'));
        } else {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                var responseObject = JSON.parse(body);
                callback(false, {accessToken: bearerToken, expires: null, tenantId: responseObject.tenantId});
            } else {
                logger.warn('Unauthorized token \'' + bearerToken + '\', status code '+ response.statusCode);
                logger.warn(body);
                callback();
            }
        }
    });
}

var oauth = oauthserver({
  model: {getAccessToken: getOAuthAccessToken},
  grants: [], // we don't provider access tokens, just verify
  debug: true
});

/** Express authorization handler. To be registered in express application. */
exports.authorise = oauth.authorise();
/**
 * Express error handler. Responsible for returning proper error responses in case of authentication failure. To be registered in express application.
 */
exports.errorHandler = oauth.errorHandler();
