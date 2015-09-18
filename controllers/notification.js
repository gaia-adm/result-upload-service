/**
 * Responsible for sending notifications to result processing service with information what to process.
 * @module controllers/notification
 */
'use strict';

var log4js = require('log4js');
var amqp = require('amqplib');
var VError = require('verror');
var WError = VError.WError;
var errorUtils = require('../util/error-utils.js');
var getFullError = errorUtils.getFullError;
var when = require('when');

var logger = log4js.getLogger('notification.js');
var channel = null;
var connection = null;

var RECONNECT_TIMEOUT = 10000;
var MAX_RECONNECT_COUNTER = 3;
var reconnectCounter = 0;
var recreateChannelTimerId = null;
var reconnectTimerId = null;

/**
 * Collects credentials for connection to MQ (RabbitMQ).
 *
 * @returns {{username: *, password: *}}
 */
function getAmqCredentials() {
    if (!process.env.AMQ_USER) {
        throw new Error('AMQ_USER environment variable is not specified');
    }
    var pwd = process.env.AMQ_PASSWORD ? process.env.AMQ_PASSWORD : '';
    return {
        username: process.env.AMQ_USER, password: pwd
    };
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

/**
 * Creates AMQ channel on which messages can be sent.
 *
 * @param conn AMQ connection
 * @returns promise
 */
function initChannel(conn) {
    var ok = conn.createConfirmChannel().then(function(ch) {
        function onClose() {
            logger.debug('Closed MQ channel');
            channel = null;
        }

        function onError(err) {
            logger.error(getFullError(new WError(err, 'Channel reached error state')));
            scheduleRecreateChannel();
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
        return ch.assertExchange('result-upload', 'direct', {durable: true}).then(function() {
        //return ch.checkExchange('wrongEx').then(function() {
            reconnectCounter = 0;
            logger.debug('Exchange \'result-upload\' has been asserted into existence');
        });
    });
    return ok.catch(function(err) {
        // in case assertExchange causes channel error this results in duplicate error message as onError logs as well
        // this doesn't happen in case of channel error during normal operation
        logger.error(getFullError(new WError(err, 'Failed to initialize channel')));
    });
}

/**
 * Initializes connection to RabbitMQ and returns promise to allow waiting for initialization completion.
 * @returns promise
 */
function initAmqConnection() {
    var credentials = getAmqCredentials();
    var url = 'amqp://' + credentials.username + ':' + credentials.password +
                '@' + getAmqServer() + '?frameMax=0x1000&heartbeat=30';

    var ok = amqp.connect(url);
    return ok.then(function(conn) {
        function onClose() {
            logger.debug('Closed MQ connection');
            connection = null;
        }

        function onError(err) {
            logger.error(getFullError(new WError(err, 'Connection reached error state')));
            scheduleReconnect();
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

        connection = conn;
        return initChannel(conn);
    }, function (err) {
        // amqp.connect failed, could be wrong password, host unreachable etc
        throw new WError(err, 'Failed to connect to RabbitMQ');
    });
}

function initAmq(handleReconnect) {
    var ok = initAmqConnection();
    return ok.catch(function(err) {
        if (handleReconnect) {
            logger.error(getFullError(new WError(err, 'Failed to initialize RabbitMQ connection')));
            scheduleReconnect();
        } else {
            throw err;
        }
    });
}

function scheduleRecreateChannel() {
    if (recreateChannelTimerId) {
        return;
    }
    function doRecreateChannel() {
        recreateChannelTimerId = null;
        closeChannel().finally(function() {
            if (connection !== null) {
                logger.debug('Recreating channel..');
                initChannel(connection);
            }
        });
    }
    reconnectCounter++;
    reconnectCounter = Math.min(reconnectCounter, MAX_RECONNECT_COUNTER);
    var delay = reconnectCounter * RECONNECT_TIMEOUT;
    logger.debug('Trying next channel recreation in ' + delay / 1000 + 's');
    recreateChannelTimerId = setTimeout(doRecreateChannel, delay);
}

function scheduleReconnect() {
    if (recreateChannelTimerId) {
        clearTimeout(recreateChannelTimerId);
        recreateChannelTimerId = null;
    }
    if (reconnectTimerId) {
        return;
    }
    function doReconnect() {
        reconnectTimerId = null;
        shutdown().finally(function() {
            logger.debug('Reconnecting to RabbitMQ..');
            initAmq(true);
        });
    }
    reconnectCounter++;
    reconnectCounter = Math.min(reconnectCounter, MAX_RECONNECT_COUNTER);
    var delay = reconnectCounter * RECONNECT_TIMEOUT;
    logger.debug('Trying next reconnect in ' + delay / 1000 + 's');
    reconnectTimerId = setTimeout(doReconnect, delay);
}

/**
 * Sends notification to result processing service.
 * @param processingMetadata bearer token that can be used for internal HTTP calls, tenantId, file path
 * @param contentMetadata object with content metadata - dataType, contentType etc.
 * @returns promise
 */
function send(processingMetadata, contentMetadata) {
    var promise = when.promise(function(resolve, reject) {
        if (!channel) {
            reject(new Error('Notification channel is not ready'));
        } else {
            channel.publish('result-upload', getRoutingKey(contentMetadata), new Buffer(JSON.stringify(contentMetadata)),
                    {mandatory: true, persistent: true, headers: processingMetadata}, function(err) {
                        // TODO: here seems to be defect in amqp library, waitForConfirms and this callback are not called
                        // with error when rabbitmq is down already
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
        }
    });
    return promise;
}

/**
 * Creates routing key for given content metadata. Determines what queue the notification goes to.
 * @param contentMetadata object with content metadata - dataType, contentType etc.
 * @returns {string} routing key
 */
function getRoutingKey(contentMetadata) {
    return contentMetadata.dataType;
}

/**
 * Closes the channel.
 *
 * @returns promise
 */
function closeChannel() {
    if (channel !== null) {
        return channel.close();
    } else {
        return when.resolve();
    }
}

/**
 * Closes the MQ connection.
 *
 * @return promise
 */
function closeConnection() {
    if (connection !== null) {
        return connection.close();
    } else {
        return when.resolve();
    }
}

/**
 * Closes all channels and connection.
 *
 * @returns promise
 */
function shutdown() {
    var ok = closeChannel();
    return ok.then(closeConnection);
}

/** To be called to initialize the notification module. This involves opening connection to RabbitMQ. Returns promise. */
exports.initAmq = initAmq;
/** Sends notification to result processing service. */
exports.send = send;
exports.shutdown = shutdown;
