'use strict';

module.exports = function (ctx) {
    return function getCurrentUserID() {
        return ctx.userID;
    }
}