"use strict";

var express = require('express'), router = express.Router();

router.use('/result-upload/rest', require('./file-upload'));

exports = module.exports = router;
