'use strict';
var chai = require("chai");
var assert = chai.assert;
var request = require('request');
var uuid = require('node-uuid');
var URI = require('URIjs');
var amqp = require('amqplib');
var fs = require('fs');
var randomstring = require("randomstring");

var service_hostname = process.env.SERVICE_HOST || 'localhost';
var service_port = process.env.SERVICE_PORT || 8080;

describe('/result-upload/v1/upload-data tests', function() {
    describe('OAuth authorization', function() {
        it('should return 400 when no access token is present', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, body: 'Hello from AuthTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 401 when access token is invalid', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: uuid.v4()
                }, body: 'Hello from AuthTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 401);
                done();
            });
        });

        it('should return 200 when access token is valid', function(done) {
            createOAuthAccessToken(function(err, accessToken) {
                var options = {
                    uri: getServiceUri(), method: 'POST', headers: {
                        'content-type': 'text/plain'
                    }, auth: {
                        sendImmediately: true, bearer: accessToken
                    }, qs: {dataType: 1}, body: 'Hello from AuthTest'
                };
                request(options, function(err, response, body) {
                    assert.notOk(err, 'No error was expected');
                    assert.strictEqual(response.statusCode, 200);
                    done();
                });
            });
        });
    });

    describe('Invalid scenarios', function() {
        var accessToken;
        before(function(done) {
            createOAuthAccessToken(function(err, newToken) {
                accessToken = newToken;
                done();
            });
        });

        it('should return 404 when invalid URI', function(done) {
            var options = {
                uri: getServiceUri() + 'invalid', method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 404);
                done();
            });
        });
    });

    describe('File metadata', function() {
        var accessToken;
        before(function(done) {
            createOAuthAccessToken(function(err, newToken) {
                accessToken = newToken;
                done();
            });
        });

        it('should return 400 when no file metadata', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when dataType is missing', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when dataType is too long', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {dataType: randomstring.generate(200)}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 200 when metadata is valid', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {dataType: 1}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 200);
                done();
            });
        });
    });

    describe('AMQ integration', function() {
        var accessToken;
        var amqConn;
        var amqCh;
        var amqQueue;

        beforeEach(function(done) {
            createOAuthAccessToken(function(err, newToken) {
                accessToken = newToken;
                amqp.connect(getAmqUrl()).then(function(conn) {
                    return conn.createChannel().then(function(ch) {
                        amqCh = ch;
                        amqQueue = 'rest-tests-queue-' + uuid.v4();
                        return ch.assertQueue(amqQueue, {exclusive: true, durable: false, autoDelete: false}).then(function() {
                            done();
                        });
                    });
                }, function(err) {
                    assert.fail(err, null, 'Failed to connect to AMQ');
                });
            });
        });

        it('must send message to AMQ and create file after file upload', function(done) {
            var fileBody = 'Hello from AMQ integration test';
            // prepare to receive message
            var dataType = uuid.v4();
            consumeMessages(dataType, function(msg) {
                var contentMetadata = JSON.parse(msg.content.toString());
                assert.strictEqual(contentMetadata.dataType, dataType);
                assert.strictEqual(contentMetadata.contentType, 'text/plain; charset=utf-8');
                assert.strictEqual(contentMetadata.mimeType, 'text/plain');
                assert.strictEqual(contentMetadata.charset, 'utf-8');
                assert.isNotNull(msg.properties.headers.path);
                var content = fs.readFileSync(msg.properties.headers.path).toString();
                assert.strictEqual(content, fileBody, 'Stored file contents doesnt match');
                done();
            }).then(function() {
                // upload file
                var options = {
                    uri: getServiceUri(), method: 'POST', headers: {
                        'content-type': 'text/plain; charset=utf-8'
                    }, auth: {
                        sendImmediately: true, bearer: accessToken
                    }, qs: {dataType: dataType}, body: fileBody
                };
                request(options, function(err, response, body) {
                    assert.notOk(err, 'No error was expected');
                    assert.strictEqual(response.statusCode, 200);
                });
            });
        });

        it('must send message to AMQ and create file after file upload - no charset', function(done) {
            var fileBody = 'Hello from AMQ integration test';
            // prepare to receive message
            var dataType = uuid.v4();
            consumeMessages(dataType, function(msg) {
                var contentMetadata = JSON.parse(msg.content.toString());
                assert.strictEqual(contentMetadata.dataType, dataType);
                assert.strictEqual(contentMetadata.contentType, 'text/plain');
                assert.strictEqual(contentMetadata.mimeType, 'text/plain');
                assert.isUndefined(contentMetadata.charset);
                assert.isNotNull(msg.properties.headers.path);
                var content = fs.readFileSync(msg.properties.headers.path).toString();
                assert.strictEqual(content, fileBody, 'Stored file contents doesnt match');
                done();
            }).then(function() {
                // upload file
                var options = {
                    uri: getServiceUri(), method: 'POST', headers: {
                        'content-type': 'text/plain'
                    }, auth: {
                        sendImmediately: true, bearer: accessToken
                    }, qs: {dataType: dataType}, body: fileBody
                };
                request(options, function(err, response, body) {
                    assert.notOk(err, 'No error was expected');
                    assert.strictEqual(response.statusCode, 200);
                });
            });
        });

        afterEach(function() {
            if (amqConn) {
                amqConn.close();
            }
        });

        function consumeMessages(routingKey, consumer) {
            return amqCh.bindQueue(amqQueue, 'result-upload', routingKey).then(function() {
                return amqCh.consume(amqQueue, function(msg) {
                    consumer(msg);
                }, {noAck: true});
            }, function(err) {
                assert.fail(err, null, 'Failed to connect to message queue');
            });
        }

        function getAmqUrl() {
            if (!process.env.AMQ_USER) {
                    throw new Error('AMQ_USER environment variable is not specified');
            }
            var pwd = process.env.AMQ_PASSWORD ? process.env.AMQ_PASSWORD : '';
            return 'amqp://' + process.env.AMQ_USER + ':' + pwd +
                        '@' + getAmqServer() + '?frameMax=0x1000&heartbeat=30';
        }
    });
});

/**
 * Returns hostname:port of RabbitMQ server.
 */
function getAmqServer() {
    if (!process.env.AMQ_SERVER) {
        throw new Error('AMQ_SERVER environment variable is not specified');
    }
    return process.env.AMQ_SERVER;
}

function getServiceUri() {
    return 'http://' + service_hostname + ':' + service_port + '/result-upload/v1/upload-data';
}

function getAuthServerUri() {
    if (!process.env.AUTH_SERVER) {
        throw new Error('AUTH_SERVER environment variable is not specified');
    }
    var auth_comps = process.env.AUTH_SERVER.split(':');
    return URI().protocol('http').hostname(auth_comps[0]).port(auth_comps[1]);
}

function createTenant(callback) {
    // create tenant, then get tenantId
    var adminUsername = 'admin_' + uuid.v4();
    var options = {
        uri: getAuthServerUri().resource('/sts/tenant').toString(), method: 'POST', json: true, body: {'adminUserName': adminUsername}
    };
    request(options, function(err, response, body) {
        assert.notOk(err, 'No error was expected');
        assert.strictEqual(response.statusCode, 201);
        // get tenantId
        options = {
            uri: getAuthServerUri().resource('/sts/tenant').toString(), method: 'GET', json: true, qs: {user: adminUsername}
        };
        request(options, function(err, response, body) {
            assert.notOk(err, 'No error was expected');
            assert.strictEqual(response.statusCode, 200);
            callback(null, body);
        });
    });
}

function createOAuthClient(callback) {
    createTenant(function(err, tenantInfo) {
        // create client
        var clientId = uuid.v4();
        var options = {
            uri: getAuthServerUri().resource('/sts/oauth/client').toString(), method: 'POST', json: true, body: {
                'client_id': clientId,
                'client_secret': 'secret',
                'scope': 'trust',
                'authorized_grant_types': 'client_credentials',
                'authorities': 'ROLE_APP',
                'additional_information': 'more data',
                'tenantId': tenantInfo.tenantId
            }
        };
        request(options, function(err, response, body) {
            assert.notOk(err, 'No error was expected');
            assert.strictEqual(response.statusCode, 201);
            callback(null, {clientId: clientId, secret: 'secret'});
        });
    });
}

function createOAuthAccessToken(callback) {
    createOAuthClient(function(err, client) {
        var options = {
            uri: getAuthServerUri().resource('/sts/oauth/token').query({
                grant_type: "client_credentials", client_id: client.clientId, client_secret: client.secret
            }).toString(), method: 'POST', json: true
        };
        request(options, function(err, response, body) {
            assert.notOk(err, 'No error was expected');
            assert.strictEqual(response.statusCode, 200);
            callback(null, body.access_token);
        });
    });
}
