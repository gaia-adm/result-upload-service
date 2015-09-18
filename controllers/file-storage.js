/**
 * File storage module. Responsible for storing files to be processed by result processing service.
 * @module controllers/file-storage
 */
'use strict';

var log4js = require('log4js');
var fs = require('fs');
var async = require('async');
var path = require('path');
var cnst = require('constants');
var uuid = require('node-uuid');
var StreamLimiter = require('../util/stream-limiter');
var VError = require('verror');
var WError = VError.WError;
var errorUtils = require('../util/error-utils.js');
var getFullError = errorUtils.getFullError;

var logger = log4js.getLogger('file-storage.js');
var RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;
var baseStoragePath;

// default limit is 50MB
var DEFAULT_UPLOAD_LIMIT = 50*1024*1024;

function getUploadLimit() {
    return process.env.UPLOAD_LIMIT || DEFAULT_UPLOAD_LIMIT;
}

/**
 * Handles storage of data from input stream into file and notifies callback upon completion/error.
 * @param is input stream
 * @param callback
 */
function storeFile(is, callback) {
    var uploadLimit = getUploadLimit();
    var limiter = new StreamLimiter(uploadLimit);
    var os; // set once output stream is created
    createWriteStream(onStreamCreated);

    function onError(err) {
        cleanup();
        is.unpipe(limiter);
        limiter.unpipe(os);
        os.end();
        // delete incomplete file
        unlinkFile(os.path);
        // continue reading even though the data will be thrown away. Destroying is would result in socket exception on client.
        is.resume();
        is.once('end', function() {
            // wait until all data has been read
            callback(err);
        });
    }
    function onFinish() {
        callback(null, os.path);
    }
    function cleanup() {
        limiter.removeListener('error', onError);

        is.removeListener('error', onError);

        os.removeListener('error', onError);
        os.removeListener('finish', onFinish);

        os.removeListener('error', cleanup);
        os.removeListener('finish', cleanup);
    }
    function onStreamCreated(err, osp) {
        if (err) {
            callback(err);
        } else {
            os = osp;
            limiter.on('error', onError);

            is.on('error', onError);

            os.on('error', onError);
            os.on('finish', onFinish);

            os.on('error', cleanup);
            os.on('finish', cleanup);

            is.pipe(limiter).pipe(os);
        }
    }
}

/**
 * Unlinks file asynchronously.
 *
 * @param path file path
 */
function unlinkFile(path) {
    fs.unlink(path, function(err) {
        if (err) {
            logger.error(getFullError(new WError(err, 'Failed to unlink ' + path)));
        }
    });
}

/**
 * Creates write stream. File will have a unique name.
 * @param callback function that will receive write stream
 */
function createWriteStream(callback) {
    var COUNTER_LIMIT = 5;
    var counter = 0;
    var os = null;

    function createStreamInternal(innerCb) {
        counter++;
        var path = generateFilename();
        fs.open(path, RDWR_EXCL, 600, function(err, fd) {
            if (err) {
                if (err.code === 'EEXIST') {
                    // do nothing, invocation will be repeated
                    innerCb();
                } else {
                    innerCb(err);
                }
            } else {
                // file is ok, create stream
                os = fs.createWriteStream(path, {flags: RDWR_EXCL, mode: 600, fd: fd});
                innerCb();
            }
        });
    }
    async.doWhilst(createStreamInternal, function test() {
        return (os === null && counter < COUNTER_LIMIT);
    }, function onEnd(err) {
        if (err) {
            callback(err);
        } else if (os === null) {
            callback(new Error('Failed to create unique file'));
        } else {
            callback(null, os);
        }
    });
}

/**
 * Generates new unique file name.
 * @returns file name
 */
function generateFilename() {
    // TODO: should accept some tenantId?
    return path.join(baseStoragePath, uuid.v4());
}

/**
 * Initializes the file storage module.
 */
function initFileStorage() {
    if (!process.env.STORAGE_PATH) {
        throw new Error('STORAGE_PATH environment variable is not specified');
    }
    if (!fs.existsSync(process.env.STORAGE_PATH)) {
        throw new Error('Path \'' + process.env.STORAGE_PATH + '\' specified by STORAGE_PATH environment variable doesn\'t exist');
    }
    // TODO: support new baseStoragePath after there are too many files in directory?
    baseStoragePath = path.join(process.env.STORAGE_PATH, uuid.v4());
    fs.mkdirSync(baseStoragePath);
    logger.info('Using ' + baseStoragePath + ' for storing uploaded files');
}

initFileStorage();

/**
 * Handles storage of data from input stream into file and notifies callback upon completion/error.
 */
exports.storeFile = storeFile;
exports.unlinkFile = unlinkFile;
