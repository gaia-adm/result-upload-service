'use strict';

var log4js = require('log4js');
var fs = require('fs');
var path = require('path');
var cnst = require('constants');
var uuid = require('node-uuid');

var logger = log4js.getLogger('file-storage.js');
var RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;
var baseStoragePath;

// handles storage of data from input stream into file and notifies callback upon completion/error
function storeFile(is, callback) {
    var os = createWriteStream();

    function onError(err) {
        is.unpipe(os);
        callback(err);
    }
    function onEnd() {
        callback(null, os.path);
    }
    function cleanup() {
        is.removeListener('end', onEnd);

        is.removeListener('end', cleanup);
        is.removeListener('close', cleanup);

        is.removeListener('error', onError);
        os.removeListener('error', onError);
    }
    is.on('end', onEnd);

    is.on('end', cleanup);
    is.on('close', cleanup);

    is.on('error', onError);
    os.on('error', onError);

    // TODO: handle upload file limits
    is.pipe(os);
}

function createWriteStream() {
    // TODO: handle uuid collision?
    return fs.createWriteStream(generateFilename(), {flags: RDWR_EXCL, mode: 600});
}

// TODO: should accept some tenantId?
function generateFilename() {
    return path.join(baseStoragePath, uuid.v4());
}

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

exports = module.exports = {storeFile : storeFile};
