'use strict';

module.exports = function (ctx) {
    return function changeBio(caption = '', publish = false) {
        let pCallback;
        const rPromise = new Promise(function (resolve, reject) {
            pCallback = error => error ? reject(error) : resolve();
        });

        if (typeof caption === 'boolean') {
            publish = caption;
            caption = '';
        }

        const body = {
            doc_id: '2725043627607610',
            variables: JSON.stringify({
                input: {
                    bio: caption,
                    publish_bio_feed_story: publish,
                    actor_id: ctx.userID,
                    client_mutation_id: Math.round(Math.random() * 1024).toString()
                },
                hasProfileTileViewID: false,
                profileTileViewID: null,
                scale: 1
            })
        }

        ctx
            .post('https://www.facebook.com/api/graphql/', { body })
            .then(function (response) {
                if (response.errors)
                    throw new Error(response.errors?.[0]?.message);

                return pCallback();
            })
            .catch(pCallback);

        return rPromise;
    }
}