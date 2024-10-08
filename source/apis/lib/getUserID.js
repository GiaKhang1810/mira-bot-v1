var utils = require("../utils");

function format(res) {
    var res = res.relay_rendering_strategy.view_model.profile;
    return {
        userID: res.id,
        name: res.name,
        isVerified: res.is_verified,
        profileUrl: res.url,
        photoUrl: res.profile_picture.uri
    }
}

module.exports = function (http, apis, ctx) {
    return function getUserID(name, callback) {
        var pCallback;
        var returnPromise = new Promise(function (resolve, reject) {
            pCallback = (error, data) => error ? reject(error) : resolve(data);
        });

        if (typeof name === "function") {
            callback = name;
            name = null;
        }
        if (typeof callback !== "function")
            callback = pCallback;

        if (typeof name !== "string")
            callback(new Error("name must be an string"));
        else {
            var form = {
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "SearchCometResultsInitialResultsQuery",
                variables: JSON.stringify({
                    count: 5,
                    allow_streaming: false,
                    args: {
                        callsite: "COMET_GLOBAL_SEARCH",
                        config: {
                            exact_match: false,
                            high_confidence_config: null,
                            intercept_config: null,
                            sts_disambiguation: null,
                            watch_config: null
                        },
                        context: {
                            bsid: utils.getGUID(),
                            tsid: null
                        },
                        experience: {
                            encoded_server_defined_params: null,
                            fbid: null,
                            type: "PEOPLE_TAB"
                        },
                        filters: [],
                        text: name.toLowerCase()
                    },
                    cursor: null,
                    feedbackSource: 23,
                    fetch_filters: true,
                    renderLocation: "search_results_page",
                    scale: 1,
                    stream_initial_count: 0,
                    useDefaultActor: false,
                    __relay_internal__pv__IsWorkUserrelayprovider: false,
                    __relay_internal__pv__IsMergQAPollsrelayprovider: false,
                    __relay_internal__pv__StoriesArmadilloReplyEnabledrelayprovider: false,
                    __relay_internal__pv__StoriesRingrelayprovider: false
                }),
                doc_id: "9946783172059974"
            }

            http
                .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, http))
                .then(function (res) {
                    if (res.error || res.errors) 
                        throw res;
                    return callback(null, res.data.serpResponse.results.edges.map(format));
                })
                .catch(function (error) {
                    if (error.type === "logout.")
                        ctx.isLogin = false;

                    return callback(error);
                });
        }

        return returnPromise;
    }
}