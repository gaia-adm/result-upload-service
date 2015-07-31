/**
 * Module for limiting count of bytes transferred over streams.
 * @module util/stream-limiter
 */
'use strict';

var util = require('util');
var Transform = require('stream').Transform;

function StreamLimiter(limit, options) {
    if (!(this instanceof StreamLimiter)) {
        return new StreamLimiter(limit, options)
    }
    Transform.call(this, options);
    this.limit = limit;
    this.length = 0;
}

util.inherits(StreamLimiter, Transform);

StreamLimiter.prototype._transform = function(chunk, encoding, done) {
    this.length += chunk.length;
    if (this.length > this.limit) {
        this.emit('error', new Error('Stream limit ' + this.limit + ' reached'));
        return;
    }
    this.push(chunk);
    done();
};

module.exports = StreamLimiter;
