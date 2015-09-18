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
        notification.initAmq(false).done(function onOk() {
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
        var dataType = uuid.v4();
        consumeMessages(dataType, function(msg) {
            var fileMetadata = JSON.parse(msg.content.toString());
            assert.strictEqual(fileMetadata.dataType, dataType);
            assert.strictEqual(fileMetadata.contentType, 'text/plain');
            done();
        }).then(function() {
            // send notification
            var ok = notification.send(null, {dataType: dataType, contentType: 'text/plain'});
            ok.catch(function onError(err) {
                console.error(err.stack);
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
        var pwd = process.env.AMQ_PASSWORD ? process.env.AMQ_PASSWORD : '';
        return 'amqp://' + process.env.AMQ_USER + ':' + pwd +
                    '@' + getAmqServer() + '?frameMax=0x1000&heartbeat=30';
    }

    /**
     * Returns hostname:port of RabbitMQ server.
     */
    function getAmqServer() {
        if (!process.env.AMQ_SERVER) {
            throw new Error('AMQ_SERVER environment variable is not specified');
        }
        return process.env.AMQ_SERVER;
    }
});
