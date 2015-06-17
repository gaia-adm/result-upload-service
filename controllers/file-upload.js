'use strict';

var express = require('express'), router = express.Router();
var HttpStatus = require('http-status-codes');
var fileStorage = require('./file-storage');
var notification = require('./notification');

var MAX_PARAM_LEN = 100;

// REST endpoints handling file upload

router.post('/v1/upload-file', function(req, res) {
    var contentType = req.get('Content-Type');
    if (req.is('multipart/mixed')) {
        // TODO: implement. Parameters are 1st part, file is 2nd part
        res.status(HttpStatus.BAD_REQUEST);
        res.json({error : 'ContentType \'' + contentType + '\' is not yet supported'});
    } else if (req.is('application/*') || req.is('text/*')) {
        var metadata = getFileMetadata(req);
        try {
            validateMetadata(metadata);
        } catch (err) {
            res.status(HttpStatus.BAD_REQUEST).json({error : err.message});
            return;
        }
        metadata.contentType = contentType;
        receiveFile(metadata, req, res);
    } else {
        // will not be supported
        res.status(HttpStatus.BAD_REQUEST);
        res.json({error: 'ContentType \'' + contentType + '\' is not supported'});
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
        tags : tagArray
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

function receiveFile(metadata, req, res) {
    fileStorage.storeFile(req, function(err, path) {
        if (err) {
            console.error(err.stack);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR);
            // TODO: in production mode don't send stack trace
            res.json({error: err.message, stacktrace: err.stack});
        } else {
            metadata.path = path;
            notification.send(metadata, function(err) {
                if (err) {
                    console.error(err.stack);
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
