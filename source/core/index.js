'use strict';

const utils = require('./utils');
const request = require('../utils/request').defaults({ jar: true });

const { randomUUID } = require('crypto');
const { writeFileSync, existsSync, readFileSync, readdirSync } = require('fs');
const { join } = require('path');

const totp = require('totp-generator');

function buildCore(params, body, jar, userID, token) {
    let region;
    const endpoint = /appID:219994525426954,endpoint:"(.+?)"/g.exec(body);

    if (endpoint) 
        region = new URL(endpoint[1].replace(/\\\//g, '/')).searchParams.get('region').toUpperCase();

    const ctx = {
        ...utils.makeDefaults(params, request, jar),
        jar,
        userID,
        token,
        region
    }

    const core = {
        getAppState: function getAppState() {
            return jar
                .getCookie('http://facebook.com/')
                .concat(jar.getCookie('http://messenger.com/'));
        }
    }

    const pCoreDirPath = join(__dirname, 'pluginCore');
    const apfileCore = readdirSync(pCoreDirPath)
        .filter(i => i.endsWith('.js'));

    for (let pfileCore of apfileCore) {
        const pCorePath = join(pCoreDirPath, pfileCore);

        try {
            core[pfileCore.replace('.js', '')] = require(pCorePath)(ctx, core, utils);
        } catch (error) {
            throw error;
        }
    }

    return core;
}

async function LoginHelper(fbstate, username, password, twofactor, access_token, proxy, retry) {
    const jar = request.getJar();

    if (retry > 2)
        throw new Error('Unable to log in, unknown error.');

    if (fbstate && fbstate.length > 0) {
        fbstate.forEach(i =>
            jar.setCookie(i, 'http://' + i.domain)
        );

        try {
            const isLiveCookie = await utils.checkLiveCookie(request);

            if (!isLiveCookie)
                throw new Error('fbstate is expired or invalid.');

            const business = await request.get('https://business.facebook.com/content_management', { proxy });
            const userID = jar.getCookie('https://www.facebook.com/').find(i => i.name === 'c_user').value;
            const params = utils.extractParameters(business.body, userID);

            let token = access_token;

            if (!token) {
                const instance = request.createClone({
                    jar,
                    proxy,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authority': 'www.facebook.com',
                        'Method': 'GET',
                        'Path': '/',
                        'Scheme': 'https',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                        'Dpr': '1',
                        'Priority': 'u=0, i',
                        'Sec-Ch-Prefers-Color-Scheme': 'dark',
                        'Sec-Ch-Ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                        'Sec-Ch-Ua-Full-Version-List': '"Chromium";v="136.0.7103.154", "Google Chrome";v="136.0.7103.154", "Not.A/Brand";v="99.0.0.0"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Model': '""',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Ch-Ua-Platform-Version': '"19.0.0"',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Viewport-Width': '1104',
                        'X-Fb-Lsd': '',
                        'X-Response-Format': 'JSONStream',
                        'X-Asbd-Id': '129477'
                    }
                });

                const body = {
                    doc_id: '6494107973937368',
                    variables: JSON.stringify({
                        input: {
                            client_mutation_id: Math.round(Math.random() * 19).toString(),
                            actor_id: userID,
                            config_enum: 'GDP_CONFIRM',
                            device_id: null,
                            experience_id: utils.generateUUID(),
                            extra_params_json: JSON.stringify({
                                app_id: '350685531728',
                                kid_directed_site: 'false',
                                logger_id: `"${utils.generateUUID()}"`,
                                next: '"confirm"',
                                redirect_uri: '"https://www.facebook.com/connect/login_success.html"',
                                response_type: '"token"',
                                return_scopes: 'false',
                                scope: '["ads_management","pages_show_list","business_management","publish_to_groups","public_profile"]',
                                steps: '{}',
                                tp: '"unspecified"',
                                cui_gk: '"[PASS]:""',
                                is_limited_login_shim: 'false',
                            }),
                            flow_name: 'GDP',
                            flow_step_type: 'STANDALONE',
                            outcome: 'APPROVED',
                            source: 'gdp_delegated',
                            surface: 'FACEBOOK_COMET'
                        }
                    }),
                    server_timestamps: 'true',
                    ...params
                }
                const options = {
                    body: Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])),
                    headers: {
                        'X-FB-Friendly-Name': 'RunPostFlowActionMutation',
                        'X-FB-LSD': params.lsd,
                        'X-FB-IRISSEQID': '1'
                    }
                }

                const response = await instance.post('https://www.facebook.com/api/graphql/', options);
                const rawURL = response.body?.data?.run_post_flow_action?.uri;

                if (rawURL) {
                    const mainUrl = new URL(rawURL);
                    const closeUri = decodeURIComponent(mainUrl.searchParams.get('close_uri'));
                    const closeUrl = new URL(closeUri);

                    token = closeUrl.hash
                        .replace(/^#/, '')
                        .split('&')
                        .find(p => p.startsWith('access_token='))
                        ?.split('=')[1];

                    if (!token.startsWith('EAAAAU')) {
                        const convertRes = await instance.get('https://api.facebook.com/method/auth.getSessionforApp', {
                            query: {
                                format: 'json',
                                access_token: token,
                                new_app_id: '350685531728'
                            }
                        });

                        token = convertRes.body?.access_token;
                    }
                }
            }

            return request
                .get('https://www.facebook.com', { proxy })
                .then(_ => {
                    const newState = jar.getCookie('https://www.facebook.com/');

                    jar
                        .setCookie(newState, 'http://facebook.com/')
                        .setCookie(newState, 'http://messenger.com/');

                    return buildCore(params, business.body, jar, userID, token);
                });
        } catch (error) {
            if (username && password)
                return LoginHelper(null, username, password, twofactor, access_token, proxy, retry += 1);

            throw error;
        }
    } else if (username && password && username.length > 0 && password.length > 0) {
        if (retry > 1)
            jar.clearCookie();

        const device = utils.randomDevice();
        const deviceID = randomUUID();
        const familyDeviceID = randomUUID();
        const adid = randomUUID();
        const machineID = utils.randomString(24);

        let formLogin = {
            adid,
            email: username,
            password,
            format: 'json',
            device_id: deviceID,
            cpl: 'true',
            family_device_id: familyDeviceID,
            locale: 'en_US',
            client_country_code: 'US',
            credentials_type: 'device_based_login_password',
            generate_session_cookies: '1',
            generate_analytics_claim: '1',
            generate_machine_id: '1',
            currently_logged_in_userid: '0',
            irisSeqID: '1',
            try_num: '1',
            enroll_misauth: 'false',
            meta_inf_fbmeta: 'NO_FILE',
            source: 'login',
            machine_id: machineID,
            fb_api_req_friendly_name: 'authenticate',
            fb_api_caller_class: 'com.facebook.account.login.protocol.Fb4aAuthHandler',
            api_key: '882a8490361da98702bf97a021ddc14d',
            access_token: '350685531728|62f8ce9f74b12f84c123cc23437a4a32',
            advertiser_id: adid,
            device_platform: 'android',
            app_version: '392.0.0.0.66',
            network_type: 'WIFI'
        }

        formLogin.sig = utils.encodeSig(utils.sortSig(formLogin));

        const instance = request.createClone({
            jar: true,
            proxy,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Fb-Friendly-Name': formLogin.fb_api_req_friendly_name,
                'X-Fb-Http-Engine': 'Liger',
                'User-Agent': device.userAgent,
                'X-Fb-Connection-Type': 'WIFI',
                'X-Fb-Net-Hni': '',
                'X-Fb-Sim-Hni': '',
                'X-Fb-Device-Group': '5120',
                'X-Tigon-Is-Retry': 'False',
                'X-Fb-Rmd': 'cached=0;state=NO_MATCH',
                'X-Fb-Request-Analytics-Tags': 'unknown',
                'Authorization': 'OAuth 0' + formLogin.access_token,
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Fb-Client-Ip': 'True',
                'X-Fb-Server-Cluster': 'True'
            }
        });

        async function fetchData(body) {
            return (await instance.post('https://b-graph.facebook.com/auth/login', { body })).body;
        }

        let data = await fetchData(formLogin);

        if (data.error && data.error.code === 401)
            throw new Error('Wrong username/password.');

        if (data.error && data.error.code === 405)
            throw new Error('Please enable two-factor authentication.');

        if (data.error && data.error.code === 406) {
            if (!twofactor || twofactor.length === 0)
                throw new Error('FACEBOOK_TWO_FACTOR isn\'t added to credentials.');

            const otp = totp(decodeURI(twofactor).replace(/\s+/g, '').toUpperCase());

            formLogin = {
                ...formLogin,
                twofactor_code: otp,
                encrypted_msisdn: '',
                userid: data?.error?.error_data?.uid,
                machine_id: data?.error?.error_data?.machine_id ?? machineID,
                first_factor: data?.error?.error_data?.login_first_factor,
                credentials_type: 'two_factor'
            }
            formLogin.sig = utils.encodeSig(utils.sortSig(formLogin));
            data = await fetchData(formLogin);
        }

        if (data.error && data.error.code === 401)
            throw new Error('Can\'t authenticate with twofactor code.');

        return LoginHelper(data.session_cookies, username, password, twofactor, data.access_token, retry);
    } else
        throw new Error('Login credentials are not provided. Please provide either fbstate or username and password.');
}

async function Login() {
    const credentials = require('../../config.json').credentials;

    try {
        const fbstate = credentials.fbstate.path && existsSync(credentials.fbstate.path) ? JSON.parse(readFileSync(credentials.fbstate.path, 'utf8')) : undefined;

        const pluginCore = await LoginHelper(
            fbstate,
            credentials.username,
            credentials.password,
            credentials.twofactor,
            undefined,
            credentials.proxy,
            1
        );

        if (credentials.fbstate.refresh && credentials.fbstate.path && credentials.fbstate.path.length > 5) {
            const newFbState = pluginCore.getAppState();
            writeFileSync(credentials.fbstate.path, JSON.stringify(newFbState, null, 4));
        }

        return pluginCore;
    } catch (error) {
        throw error;
    }
}

module.exports = Login;