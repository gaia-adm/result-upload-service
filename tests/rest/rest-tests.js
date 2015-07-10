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

var auth_hostname = 'authserver';
var auth_port = process.env.AUTH_PORT || 8080;

describe('/result-upload/rest/v1/upload-file tests', function() {
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
                    }, qs: {metric: 1, category: 2, name: 3}, body: 'Hello from AuthTest'
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

        it('should return 400 when timestamp is invalid', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: 1, category: 2, name: 3, timestamp: 'mustbenumber'}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when name is missing', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: 1, category: 2, timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when name is too long', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: 1, category: 2, name: randomstring.generate(200), timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when source is too long', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: 1, category: 2, name: 3, source: randomstring.generate(200), timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when category is missing', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: 1, name: 3, timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when category is too long', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: 1, category: randomstring.generate(200), name: 3, timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when metric is missing', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {category: 2, name: 3, timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
            };
            request(options, function(err, response, body) {
                assert.notOk(err, 'No error was expected');
                assert.strictEqual(response.statusCode, 400);
                done();
            });
        });

        it('should return 400 when metric is too long', function(done) {
            var options = {
                uri: getServiceUri(), method: 'POST', headers: {
                    'content-type': 'text/plain'
                }, auth: {
                    sendImmediately: true, bearer: accessToken
                }, qs: {metric: randomstring.generate(200), category: 2, name: 3, timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
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
                }, qs: {metric: 1, category: 2, name: 3, timestamp: new Date().getTime()}, body: 'Hello from FileMetadataTest'
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
            var metric = uuid.v4();
            var category = uuid.v4();
            consumeMessages(metric + '/' + category, function(msg) {
                var fileMetadata = JSON.parse(msg.content.toString());
                assert.strictEqual(fileMetadata.metric, metric);
                assert.strictEqual(fileMetadata.category, category);
                assert.strictEqual(fileMetadata.name, '3');
                assert.isNotNull(fileMetadata.timestamp);
                assert.strictEqual(fileMetadata.contentType, 'text/plain');
                assert.isNotNull(fileMetadata.path);
                var content = fs.readFileSync(fileMetadata.path).toString();
                assert.strictEqual(content, fileBody, 'Stored file contents doesnt match');
                done();
            }).then(function() {
                // upload file
                var options = {
                    uri: getServiceUri(), method: 'POST', headers: {
                        'content-type': 'text/plain'
                    }, auth: {
                        sendImmediately: true, bearer: accessToken
                    }, qs: {metric: metric, category: category, name: 3, timestamp: new Date().getTime()}, body: fileBody
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
            if (!process.env.AMQ_PASSWORD) {
                    throw new Error('AMQ_PASSWORD environment variable is not specified');
            }
            var amq_hostname = process.env.AMQ_HOSTNAME || 'amqserver';
            var amq_port = process.env.AMQ_PORT || '5672';

            return 'amqp://' + process.env.AMQ_USER + ':' + process.env.AMQ_PASSWORD +
                        '@' + amq_hostname + ':' + amq_port + '?frameMax=0x1000&heartbeat=30';
        }
    });
});

function getServiceUri() {
    return 'http://' + service_hostname + ':' + service_port + '/result-upload/rest/v1/upload-file';
}

function getAuthServerUri() {
    return URI().protocol('http').hostname(auth_hostname).port(auth_port);
}

function createOAuthClient(callback) {
    // create client
    var clientId = uuid.v4();
    var options = {
        uri: getAuthServerUri().resource('/sts/oauth/client').toString(), method: 'POST', json: true, body: {
            'client_id': clientId,
            'client_secret': 'secret',
            'scope': 'trust',
            'authorized_grant_types': 'client_credentials',
            'authorities': 'ROLE_APP',
            'additional_information': 'more data'
        }
    };
    request(options, function(err, response, body) {
        assert.notOk(err, 'No error was expected');
        assert.strictEqual(response.statusCode, 201);
        callback(null, {clientId: clientId, secret: 'secret'});
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
