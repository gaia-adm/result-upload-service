'use strict';

var express = require('express'), app = express();

app.use(require('./controllers'));

var PORT = 8080;

app.listen(PORT, function() {
    console.log('Running on http://localhost:' + PORT);
});
