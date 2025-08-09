'use strict';

module.exports = function (ctx) {
    return function getToken() {
        if (ctx.token)
            return ctx.token;

        throw new Error('token is undefined.');
    }
}