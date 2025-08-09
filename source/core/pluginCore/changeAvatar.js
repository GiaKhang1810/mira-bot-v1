'use strict';

module.exports = function (ctx, core, utils) {
    function handleUpload(image) {
        let callback;
        const rPromise = new Promise(function (resolve, reject) {
            callback = (error, response) => error ? reject(error) : resolve(response);
        });

        if (!utils.isReadableStream(image))
            callback(new Error('image must be a readable stream'));
        else {
            const options = {
                query: {
                    profile_id: ctx.userID,
                    photo_source: 57
                },
                body: {
                    profile_id: ctx.userID,
                    photo_source: 57,
                    av: ctx.userID,
                    file: image
                }
            }

            ctx
                .postData('https://www.facebook.com/profile/picture/upload/', options)
                .then(function (response) {
                    return callback(null, response);
                })
                .catch(callback);
        }

        return rPromise;
    }

    return function changeAvatar(image, caption = '', timestamp = null) {
        let callback;
        const rPromise = new Promise(function (resolve, reject) {
            callback = error => error ? reject(error) : resolve();
        });

        if (typeof caption === 'number') {
            timestamp = caption;
            caption = '';
        }

        handleUpload(image)
            .then(function () {
                return callback();
            })
            .catch(callback);

        return rPromise;
    }
}