'use strict';

var express = require('express'), router = express.Router();
var HttpStatus = require('http-status-codes');
var fs = require('fs');
var path = require('path');
var cnst = require('constants');
var uuid = require('node-uuid');

var MAX_PARAM_LEN = 100;
var RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;
var baseStoragePath;

// REST endpoints handling file upload

router.post('/v1/upload-file', function(req, res) {
    var contentType = req.get('Content-Type');
    if (req.is('multipart/mixed')) {
        // TODO: implement. Parameters are 1st part, file is 2nd part
        res.status(HttpStatus.BAD_REQUEST);
        res.send({error : 'ContentType \'' + contentType + '\' is not yet supported'});
    } else if (req.is('application/*') || req.is('text/*')) {
        var metadata = getFileMetadata(req);
        try {
            validateMetadata(metadata);
        } catch (err) {
            res.status(HttpStatus.BAD_REQUEST).send({error : err.message});
            return;
        }
        storeFile(metadata, req, res);
    } else {
        // will not be supported
        res.status(HttpStatus.BAD_REQUEST);
        res.send({error: 'ContentType \'' + contentType + '\' is not supported'});
    }
});

function getFileMetadata(req) {
    var tagArray = [], tags = req.query.tags;
    if (tags !== undefined && tags != null) {
        tagArray = tags.toString().split(',');
    }
    return {
        metric : req.query.metric,
        category : req.query.category,
        name : req.query.name,
        timestamp : req.query.timestamp,
        tags : tagArray,
        contentType : req.contentType
    };
}

// returns true if metadata is valid, throws Error otherwise
function validateMetadata(fileMetadata) {
    var requiredFields = ['metric', 'category', 'name'];
    requiredFields.forEach(function(requiredField) {
        if (fileMetadata.hasOwnProperty(requiredField)) {
            var value = fileMetadata[requiredField];
            if (value === undefined || value === null) {
                throw new Error('Missing parameter \'' + requiredField + '\'');
            }
            if (value.length === 0) {
                throw new Error('Value of \'' + requiredField + '\' must not be empty');
            }
            if (value.length > MAX_PARAM_LEN) {
                throw new Error('Value of \'' + requiredField + '\' exceeds ' + MAX_PARAM_LEN + ' characters');
            }
        } else {
            throw new Error('Missing parameter \'' + requiredField + '\'');
        }
    })
}

function storeFile(metadata, req, res) {
    var ostream = createWriteStream();

    function onerror(err) {
        console.error(err.stack);
        req.unpipe(ostream);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        // TODO: in production mode don't send stack trace
        res.send({error: err.message, stacktrace: err.stack});
    }
    function onend() {
        res.status(HttpStatus.OK);
        res.send();
    }
    function cleanup() {
        req.removeListener('end', onend);

        req.removeListener('end', cleanup);
        req.removeListener('close', cleanup);

        req.removeListener('error', onerror);
        ostream.removeListener('error', onerror);
    }
    req.on('end', onend);

    req.on('end', cleanup);
    req.on('close', cleanup);

    req.on('error', onerror);
    ostream.on('error', onerror);

    // TODO: handle upload file limits
    req.pipe(ostream);
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
    console.log('Using ' + baseStoragePath + ' for storing uploaded files');
}

initFileStorage();

exports = module.exports = router;
