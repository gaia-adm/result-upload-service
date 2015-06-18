/**
 * Responsible for sending notifications to result processing service with information what to process.
 * @module controllers/notification
 */
"use strict";

var log4js = require('log4js');
var amqp = require('amqplib');
var VError = require('verror');

var logger = log4js.getLogger('notification.js');
var channel = null;

/**
 * Collects credentials for connection to AMQ (RabbitMQ).
 *
 * @returns {{username: *, password: *}}
 */
function getAmqCredentials() {
    if (!process.env.AMQ_USER) {
        throw new Error('AMQ_USER environment variable is not specified');
    }
    if (!process.env.AMQ_PASSWORD) {
        throw new Error('AMQ_PASSWORD environment variable is not specified');
    }
    return {
        username: process.env.AMQ_USER, password: process.env.AMQ_PASSWORD
    };
}

/**
 * Creates AMQ channel on which messages can be sent.
 *
 * @param conn AMQ connection
 * @returns promise
 */
function initChannel(conn) {
    return conn.createConfirmChannel().then(function(ch) {
        // TODO: handle channel recreation in case of close caused by error
        function onClose() {
            channel = null;
        }

        function onError(err) {
            logger.error(err.stack);
        }

        function cleanup() {
            ch.removeListener('close', onClose);
            ch.removeListener('error', onError);

            ch.removeListener('close', cleanup);
        }

        ch.on('close', onClose);
        ch.on('error', onError);

        ch.on('close', cleanup);

        channel = ch;
    });
}

/**
 * Initializes connection to RabbitMQ and returns promise to allow waiting for initialization completion.
 * @returns promise
 */
function initAmq() {
    var credentials = getAmqCredentials();
    var url = 'amqp://' + credentials.username + ':' + credentials.password +
                '@amqserver:5672?frameMax=0x1000&heartbeat=30';

    return amqp.connect(url).then(function(conn) {
        // TODO: handle reconnect in case close caused by certain errors (not invalid credentials)
        function onClose() {
        }

        function onError(err) {
            logger.error(err.stack);
        }

        function cleanup() {
            conn.removeListener('close', onClose);
            conn.removeListener('error', onError);

            conn.removeListener('close', cleanup);
        }

        conn.on('close', onClose);
        conn.on('error', onError);

        conn.on('close', cleanup);

        logger.info('Connected to AMQ');

        return initChannel(conn);
    }, function (err) {
        logger.error(err.stack);
        throw new VError(err, 'Failed to connect to AMQ');
    });
}

/**
 * Sends notification to result processing service.
 * @param fileMetadata object with file metadata - path, metric, category etc.
 * @param callback
 */
function send(fileMetadata, callback) {
    if (!channel) {
        throw new Error('Notification channel is not ready');
    }
    channel.publish('', getRoutingKey(fileMetadata), new Buffer(JSON.stringify(fileMetadata)),
            {mandatory: true, persistent: true}, callback);
}

/**
 * Creates routing key for given file metadata. Determines what queue the notification goes to.
 * @param fileMetadata object with file metadata - path, metric, category etc.
 * @returns {string} routing key
 */
function getRoutingKey(fileMetadata) {
    return fileMetadata.metric + '/' + fileMetadata.category;
}

/** To be called to initialize the notification module. This involves opening connection to RabbitMQ. Returns promise. */
exports.initAmq = initAmq;
/** Sends notification to result processing service. */
exports.send = send;
