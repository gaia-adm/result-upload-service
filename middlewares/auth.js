'use strict';

var oauthserver = require('oauth2-server');

function getTestAccessToken(bearerToken, callback) {
    // we would call remote service to get the access token here
    if (bearerToken == 'letmein') {
        return callback(false, {accessToken: bearerToken, user: 'testuser', expires: null});
    }
    callback(false, false);
}

var oauth = oauthserver({
  model: {getAccessToken: getTestAccessToken},
  grants: [], // we don't provider access tokens, just verify
  debug: true
});

exports.authorise = oauth.authorise();
