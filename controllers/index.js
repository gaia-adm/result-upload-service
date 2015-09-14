'use strict';

var express = require('express'), router = express.Router();

router.use('/result-upload/v1', require('./file-upload'));

exports = module.exports = router;
