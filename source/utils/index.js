'use strict';

const { readdirSync } = require('fs');
const { join } = require('path');
const utils = {}

readdirSync(__dirname)
    .forEach(file => {
        if (file === 'index.js' && !file.startsWith('.js')) 
            return;

        const name = file.slice(0, -3);
        utils[name] = require(join(__dirname, file));
    });

module.exports = utils;