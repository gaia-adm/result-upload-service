'use strict';

var oauthserver = require('oauth2-server');
var request = require('request');
var VError = require('verror');

function getTestAccessToken(bearerToken, callback) {
    var options = {
        uri: 'http://authserver:9001/auth/oauth/check_token',
        method: 'GET',
        qs: {token: bearerToken}
    };
    request(options, function(err, response, body) {
        if (err) {
            console.error(err.stack);
            callback(new VError(err, 'Failed to verify bearer token due to error'));
        } else {
            if (response.statusCode == 200) {
                callback(false, {accessToken: bearerToken, expires: null});
            } else {
                console.warn('Unauthorized token \'' + bearerToken + '\', status code '+ response.statusCode);
                console.warn(body);
                callback();
            }
        }
    });
}

var oauth = oauthserver({
  model: {getAccessToken: getTestAccessToken},
  grants: [], // we don't provider access tokens, just verify
  debug: true
});

exports.authorise = oauth.authorise();
exports.errorHandler = oauth.errorHandler();
