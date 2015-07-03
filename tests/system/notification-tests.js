'use strict';
var chai = require("chai");
var assert = chai.assert;
var uuid = require('node-uuid');
var amqp = require('amqplib');
var notification = require("./../../controllers/notification");

describe('notification tests', function() {
    var amqConn;
    var amqCh;
    var amqQueue;

    before(function(done) {
        notification.initAmq().done(function onOk() {
            done();
        }, function onError(err) {
            assert.fail(err, null, 'Failed to init notification module');
        });
    });

    beforeEach(function(done) {
        amqp.connect(getAmqUrl()).then(function(conn) {
            return conn.createChannel().then(function(ch) {
                amqCh = ch;
                amqQueue = 'notification-tests-queue-' + uuid.v4();
                return ch.assertQueue(amqQueue, {exclusive: true, durable: false, autoDelete: false}).then(function() {
                    done();
                });
            });
        }, function(err) {
            assert.fail(err, null, 'Failed to connect to AMQ');
        });
    });

    it('send notification must succeed', function(done) {
        // prepare to receive message
        var metric = uuid.v4();
        var category = uuid.v4();
        consumeMessages(metric + '/' + category, function(msg) {
            var fileMetadata = JSON.parse(msg.content.toString());
            assert.strictEqual(fileMetadata.metric, metric);
            assert.strictEqual(fileMetadata.category, category);
            assert.strictEqual(fileMetadata.name, '3');
            assert.strictEqual(fileMetadata.contentType, 'text/plain');
            done();
        }).then(function() {
            // send notification
            notification.send({metric: metric, category: category, name: '3', contentType: 'text/plain'}, function(err) {
                assert.notOk(err, 'No error was expected');
            });
        });
    });

    afterEach(function() {
        if (amqConn) {
            amqConn.close();
        }
    });

    after(function(done) {
        notification.shutdown().done(function onOk() {
            done();
        }, function onError(err) {
            assert.fail(err, null, 'Failed to disconnect from AMQ');
        });
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
