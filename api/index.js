'use strict';
const path = require('path');
require('module-alias').addAlias('@', path.resolve(__dirname, '..', 'src'));
require('dotenv/config');
const { app } = require('../src/application/app');
module.exports = app;
