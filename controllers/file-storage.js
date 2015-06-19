/**
 * File storage module. Responsible for storing files to be processed by result processing service.
 * @module controllers/file-storage
 */
'use strict';

var log4js = require('log4js');
var fs = require('fs');
var path = require('path');
var cnst = require('constants');
var uuid = require('node-uuid');

var logger = log4js.getLogger('file-storage.js');
var RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;
var baseStoragePath;

/**
 * Handles storage of data from input stream into file and notifies callback upon completion/error.
 * @param is input stream
 * @param callback
 */
function storeFile(is, callback) {
    var os = createWriteStream();

    function onError(err) {
        is.unpipe(os);
        callback(err);
    }
    function onFinish() {
        callback(null, os.path);
    }
    function cleanup() {
        is.removeListener('error', onError);

        os.removeListener('error', onError);
        os.removeListener('finish', onFinish);

        os.removeListener('error', cleanup);
        os.removeListener('finish', cleanup);
    }

    is.on('error', onError);

    os.on('error', onError);
    os.on('finish', onFinish);

    os.on('error', cleanup);
    os.on('finish', cleanup);

    // TODO: handle upload file limits
    is.pipe(os);
}

/**
 * Creates write stream. File will have unique name.
 * @returns output stream
 */
function createWriteStream() {
    // TODO: handle uuid collision?
    return fs.createWriteStream(generateFilename(), {flags: RDWR_EXCL, mode: 600});
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
