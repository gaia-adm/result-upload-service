'use strict';
var chai = require("chai");
var assert = chai.assert;
var fs = require('fs');
var fileStorage = require("./../../controllers/file-storage");
var stream = require('stream');

describe('file-storage tests', function() {
    it('store file must succeed', function(done) {
        var fileContent = 'Store file test content';
        var is = new stream.Readable();
        is.push(fileContent);
        is.push(null);

        fileStorage.storeFile(is, function(err, path) {
            assert.notOk(err, 'No error was expected');
            var content = fs.readFileSync(path).toString();
            assert.strictEqual(content, fileContent, 'Stored file contents doesnt match');
            done();
        });
    });
});
