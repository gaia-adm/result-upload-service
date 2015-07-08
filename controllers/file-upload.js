/**
 * Responsible for handling file upload. Accepted file must be saved in file storage and notification be sent to result processing service.
 * @module controllers/file-upload
 */
'use strict';

var log4js = require('log4js');
var express = require('express'), router = express.Router();
var HttpStatus = require('http-status-codes');
var fileStorage = require('./file-storage');
var notification = require('./notification');
var validate = require("validate.js");

var logger = log4js.getLogger('file-upload.js');
// REST endpoints handling file upload

router.post('/v1/upload-file', function(req, res) {
    var contentType = req.get('Content-Type');
    if (req.is('multipart/mixed')) {
        // TODO: implement. Parameters are 1st part, file is 2nd part
        res.status(HttpStatus.BAD_REQUEST);
        res.json({error : 'ContentType \'' + contentType + '\' is not yet supported'});
    } else if (req.is('application/*') || req.is('text/*')) {
        var fileMetadata = getFileMetadata(req);
        var validationResult = validateMetadata(fileMetadata);
        if (validationResult) {
            res.status(HttpStatus.BAD_REQUEST).json({error : validationResult});
            return;
        }
        // add other useful properties
        fileMetadata.contentType = contentType;
        receiveFile(req.oauth.bearerToken.accessToken, fileMetadata, req, res);
    } else {
        // will not be supported
        res.status(HttpStatus.BAD_REQUEST);
        res.json({error: 'ContentType \'' + contentType + '\' is not supported'});
    }
});

/**
 * Extracts file metadata from express request
 * @param req express request
 * @returns object with file metadata
 */
function getFileMetadata(req) {
    return {
        metric : req.query.metric,
        category : req.query.category,
        name : req.query.name,
        source: req.query.source,
        timestamp : req.query.timestamp
    };
}

/**
 * Performs validation of file metadata.
 *
 * @param fileMetadata object with file metadata
 * @returns nothing if metadata is valid or object with attributes having arrays of errors if there was an error
 */
function validateMetadata(fileMetadata) {
    var constraints = {
        metric: {
            presence: true, length: {maximum: 100}
        },
        category: {
            presence: true, length: {maximum: 100}
        },
        name: {
            presence: true, length: {maximum: 100}
        },
        source: {
            presence: false, length: {maximum: 100}
        },
        timestamp: {
            numericality: {greaterThan: 0, onlyInteger: true}
        }
    };
    return validate(fileMetadata, constraints);
}

/**
 * Handles reception of file.
 *
 * @param authorization bearer token that can be used for internal HTTP calls
 * @param fileMetadata object with file metadata
 * @param req express request
 * @param res express response
 */
function receiveFile(authorization, fileMetadata, req, res) {
    fileStorage.storeFile(req, function(err, path) {
        if (err) {
            logger.error(err.stack);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR);
            // TODO: in production mode don't send stack trace
            res.json({error: err.message, stacktrace: err.stack});
        } else {
            fileMetadata.path = path;
            notification.send(authorization, fileMetadata, function(err) {
                if (err) {
                    logger.error(err.stack);
                    res.status(HttpStatus.INTERNAL_SERVER_ERROR);
                    // TODO: in production mode don't send stack trace
                    res.json({error: err.message, stacktrace: err.stack});
                } else {
                    res.status(HttpStatus.OK);
                    res.send();
                }
            });
        }
    });
}

exports = module.exports = router;
