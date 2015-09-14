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
var errorReporter = require('../util/error-reporter');
var validate = require("validate.js");
var contentTypeParser = require('content-type');

var logger = log4js.getLogger('file-upload.js');
// REST endpoints handling data upload

router.post('/upload-data', function(req, res) {
    var contentType = req.get('Content-Type');
    logger.debug('[x] Request ' + req.originalUrl);
    if (req.is('multipart/mixed')) {
        // TODO: implement. Parameters are 1st part, file is 2nd part
        res.status(HttpStatus.BAD_REQUEST);
        res.json({error : 'ContentType \'' + contentType + '\' is not yet supported'});
    } else if (req.is('application/*') || req.is('text/*')) {
        var contentMetadata = getContentMetadata(req);
        var validationResult = validateMetadata(contentMetadata);
        if (validationResult) {
            res.status(HttpStatus.BAD_REQUEST).json({error : validationResult});
            return;
        }
        var processingMetadata = {
            accessToken: req.oauth.bearerToken.accessToken,
            tenantId: req.oauth.bearerToken.tenantId
        };
        receiveFile(processingMetadata, contentMetadata, req, res);
    } else {
        // will not be supported
        res.status(HttpStatus.BAD_REQUEST);
        res.json({error: 'ContentType \'' + contentType + '\' is not supported'});
    }
});

/**
 * Extracts content metadata from express request
 * @param req express request
 * @returns object with content metadata
 */
function getContentMetadata(req) {
    var contentMetadata = {};
    for (var prop in req.query) {
        if (req.query.hasOwnProperty(prop)) {
            contentMetadata[prop] = req.query[prop];
        }
    }
    var contentType = req.get('Content-Type');
    // add content type header and parsed values (mimeType & charset)
    contentMetadata.contentType = contentType;
    var parsedContentType = contentTypeParser.parse(contentType);
    contentMetadata.mimeType = parsedContentType.type;
    if (parsedContentType.parameters.charset) {
        contentMetadata.charset = parsedContentType.parameters.charset;
    }
    return contentMetadata;
}

/**
 * Performs validation of content metadata.
 *
 * @param contentMetadata object with file metadata
 * @returns nothing if metadata is valid or object with attributes having arrays of errors if there was an error
 */
function validateMetadata(contentMetadata) {
    var constraints = {
        dataType: {
            presence: true, length: {maximum: 100}
        }
    };
    return validate(contentMetadata, constraints);
}

/**
 * Handles reception of file.
 *
 * @param processingMetadata internal metadata containing accessToken that can be used for internal HTTP calls, tenantId
 * @param contentMetadata object with content metadata
 * @param req express request
 * @param res express response
 */
function receiveFile(processingMetadata, contentMetadata, req, res) {
    fileStorage.storeFile(req, function(err, path) {
        if (err) {
            logger.error(err.stack);
            errorReporter.reportError(res, err);
        } else {
            processingMetadata.path = path;
            notification.send(processingMetadata, contentMetadata, function(err) {
                if (err) {
                    logger.error(err.stack);
                    errorReporter.reportError(res, err);
                } else {
                    res.status(HttpStatus.OK);
                    res.send();
                }
            });
        }
    });
}

exports = module.exports = router;
