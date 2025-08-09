'use strict';

const { isArray, isObject, isURLSearchParams } = require('./type');

const { Readable } = require('stream');

const { HttpsProxyAgent } = require('https-proxy-agent');
const FormData = require('form-data');

function deepMerge(target, source) {
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key] || !isObject(target[key]))
                    target[key] = {}

                deepMerge(target[key], source[key]);
            } else
                target[key] = source[key];
        }
    }
    return target;
}

class CookieManager {
    constructor(cookies, url) {
        this.storage = {}

        if (!cookies || !url)
            return;

        url = Array.isArray(url) ? url : [url];
        for (const u of url)
            this.setCookie(cookies, u);
    }

    getDomain(url) {
        try {
            const hostname = new URL(url).hostname;
            const parts = hostname.split('.');

            if (parts.length >= 2)
                return parts.slice(-2).join('.');
            else
                return hostname;
        } catch {
            return url;
        }
    }

    setCookie(rawCookie, url) {
        const domain = this.getDomain(url);
        if (!this.storage[domain])
            this.storage[domain] = {};

        const cookies = isArray(rawCookie) ? rawCookie : [rawCookie];

        for (const cookie of cookies) {
            if (typeof cookie === 'string') {
                const parts = cookie.split(';');
                const [nameValue, ...attrParts] = parts;
                const [name, value] = nameValue.split('=').map(s => s.trim());

                if (!name || !value)
                    continue;

                this.storage[domain][name] = {
                    value,
                    path: '/',
                    expires: Infinity,
                }

                for (const attr of attrParts) {
                    const [attrName, attrValue] = attr.split('=').map(s => s.trim().toLowerCase());
                    if (attrName === 'expires') {
                        const expiresTime = new Date(attrValue).getTime();
                        if (!isNaN(expiresTime))
                            this.storage[domain][name].expires = expiresTime;
                    } else if (attrName === 'path') {
                        this.storage[domain][name].path = attrValue || '/';
                    }
                }
            } else if (isObject(cookie) && cookie.name && cookie.value) {
                const name = cookie.name;
                this.storage[domain][name] = {
                    value: cookie.value,
                    path: cookie.path || '/',
                    expires: cookie.expires || Infinity,
                }
            }
        }


        this.cleanExpired(domain);

        return this;
    }

    getCookie(url) {
        const domain = this.getDomain(url);
        const now = Date.now();

        const domains = Object.keys(this.storage).filter(d => domain === d || domain.endsWith('.' + d));
        const result = [];

        for (const d of domains) {
            this.cleanExpired(d);
            if (!this.storage[d])
                continue;

            for (const [name, data] of Object.entries(this.storage[d])) {
                if (data.expires && now > data.expires) {
                    delete this.storage[d][name];
                    continue;
                }

                result.push({
                    name,
                    value: data.value,
                    path: data.path || '/',
                    expires: data.expires ?? Infinity,
                    domain: d
                });
            }
        }

        return result;
    }

    clearCookie(url) {
        if (!url) {
            this.storage = {}
            return;
        }

        const domain = this.getDomain(url);
        delete this.storage[domain];

        return this;
    }

    cleanExpired(domain) {
        const now = Date.now();
        if (!this.storage[domain])
            return;

        for (const name in this.storage[domain]) {
            const cookie = this.storage[domain][name];
            if (cookie.expires && now > cookie.expires)
                delete this.storage[domain][name];
        }

        if (Object.keys(this.storage[domain]).length === 0)
            delete this.storage[domain];
    }
}


const hideKeys = ['config', 'jar'];
const defaultJar = new CookieManager();
const defaultOptions = {
    method: 'GET',
    timeout: 0,
    headers: {
        'Priority': 'u=0, i',
        'Sec-Ch-Ua': 'Chromium;v=134, Not:A-Brand;v=24, Google Chrome;v=134',
        'Sec-Ch-Ua-Full-Version-List': 'Chromium;v=134.0.6998.119, Not:A-Brand;v=24.0.0.0, Google Chrome;v=134.0.6998.119',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Model': '',
        'Sec-Ch-Ua-Platform': 'Windows',
        'Sec-Ch-Ua-Platform-Version': '19.0.0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
    },
    baseURL: '',
    redirect: 'follow',
    keepalive: false,
    credentials: 'include',
    responseType: 'json',
    mode: 'cors',
}

function Request(config) {
    this.config = config;

    if (this.config.jar) {
        this.jar = this.config.jar instanceof CookieManager ?
            this.config.jar :
            defaultJar;

        this.setJar = jar => {
            if (jar instanceof CookieManager)
                this.jar = jar;
            else
                throw new Error('Jar must be an instance of CookieManager');
        }

        this.getJar = () => this.jar;
    }
}

Request.prototype.createClone = function createClone(config = defaultOptions) {
    const context = new Request(config);
    const instance = Request.prototype.request.bind(context);

    Object.setPrototypeOf(instance, Request.prototype);

    for (const name of Object.keys(context)) {
        if (hideKeys.includes(name)) {
            Object.defineProperty(instance, name, {
                value: context[name],
                writable: true,
                configurable: true,
                enumerable: false
            });
        } else
            instance[name] = context[name];
    }

    instance.defaults = function Defaults(newConfig) {
        const mergedConfig = deepMerge({ ...this.config }, newConfig);
        return createClone(mergedConfig);
    }

    return instance;
}

Request.prototype.request = function request(options, callback) {
    let pCallback, timeoutID;
    const rPromise = new Promise(function (resolve, reject) {
        pCallback = callback ?? function (error, response) {
            if (error)
                reject(error);
            else
                resolve(response);
        }
    });

    const merged = deepMerge({ ...this.config }, options);

    let finalUrl = merged.url || '';
    if (merged.baseURL && !/^https?:\/\//i.test(finalUrl))
        finalUrl = merged.baseURL.replace(/\/+$/, '') + '/' + finalUrl.replace(/^\/+/, '');

    if (merged.query) {
        const urlObj = new URL(finalUrl);
        const searchParams = new URLSearchParams(urlObj.search);

        for (const name in merged.query) {
            searchParams.set(name, merged.query[name]);
        }

        urlObj.search = searchParams.toString();
        finalUrl = urlObj.toString();
    }

    let headers = {
        ...this.config.headers,
        ...merged.headers || {}
    }

    if (this.jar ?? merged.jar) {
        const cookieArr = (this.jar ?? merged.jar).getCookie(finalUrl);

        const cookieStr = cookieArr
            .map(i => i.name + '=' + i.value)
            .join('; ');

        if (cookieStr)
            headers.Cookie = cookieStr;
    }

    const fetchOptions = {
        method: merged.method || 'GET',
        redirect: merged.redirect,
        keepalive: merged.keepalive,
        credentials: merged.credentials,
        mode: merged.mode
    }

    if (merged.timeout && merged.timeout > 0) {
        const controller = new AbortController();
        const timeout = merged.timeout || 5000;
        timeoutID = setTimeout(() => controller.abort(), timeout);
    }

    if (merged.proxy)
        fetchOptions.agent = new HttpsProxyAgent(merged.proxy);

    if (merged.body) {
        let body = merged.body;
        const ctt = headers['Content-Type'];

        if (ctt) {
            if (
                ctt === 'application/json' &&
                isObject(body)
            )
                body = JSON.stringify(body);
            else if (ctt === 'application/x-www-form-urlencoded') {
                if (isURLSearchParams(body))
                    body = body.toString();
                else if (isObject(body))
                    body = (new URLSearchParams(body)).toString();
            } else if (ctt === 'multipart/form-data') {
                if (isObject(body)) {
                    const form = new FormData();

                    function appendData(name, value) {
                        if (value instanceof Readable)
                            form.append(name, value);
                        else if (value && value.value && value.options)
                            form.append(name, value.value, value.options);
                        else
                            form.append(name, value);
                    }

                    for (const name in body) {
                        const value = body[name];

                        if (isArray(value)) {
                            for (let i = 0; i < value.length; i++)
                                appendData(name, value[i]);
                        } else
                            appendData(name, value);
                    }

                    delete headers['Content-Type'];
                    headers = {
                        ...headers,
                        ...form.getHeaders()
                    }
                    body = form;
                } else if (body instanceof FormData) {
                    delete headers['Content-Type'];
                    headers = {
                        ...headers,
                        ...body.getHeaders()
                    }
                } else if (body instanceof Readable)
                    headers['Content-Type'] = 'application/octet-stream';
            }
        } else {
            if (body instanceof FormData) {
                delete headers['Content-Type'];
                headers = {
                    ...headers,
                    ...body.getHeaders?.()
                }
            } else if (isURLSearchParams(body)) {
                body = body.toString();
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else if (isObject(body)) {
                body = JSON.stringify(body);
                headers['Content-Type'] = 'application/json';
            } else if (body instanceof Readable) 
                headers['Content-Type'] = 'application/octet-stream';
            else if (typeof body === 'string')
                headers['Content-Type'] = 'text/plain';
        }

        merged.headers = headers;
        merged.body = body;
    }

    fetchOptions.body = merged.body;
    fetchOptions.headers = headers;

    fetch(finalUrl, fetchOptions)
        .then(response => {
            const rawCookie = response.headers.get('set-cookie');

            if (rawCookie && (this.jar ?? merged.jar))
                (this.jar ?? merged.jar).setCookie(rawCookie, finalUrl);

            const type = merged.responseType || 'json';

            function parseResponse() {
                if (type === 'blob')
                    return response.blob();
                else if (type === 'arraybuffer')
                    return response.arrayBuffer();
                else if (type === 'formdata')
                    return response.formData();
                else
                    return response.text();
            }

            return parseResponse()
                .then(data => {
                    if (type === 'json') {
                        try {
                            data = JSON.parse(data);
                        } catch { }
                    }

                    const responseObj = {
                        status: response.status,
                        config: {
                            ...this.config,
                            ...merged
                        },
                        headers: Object.fromEntries(response.headers.entries()),
                        body: data,
                        url: response.url
                    }
                    pCallback(null, responseObj);
                });
        })
        .catch(error => {
            if (error.name === 'AbortError')
                pCallback(new Error('Request timed out'));
            else
                pCallback(error);
        })
        .finally(_ => {
            if (timeoutID)
                clearTimeout(timeoutID);
        });

    return rPromise;
}

Request.prototype.get = function get(url, options = defaultOptions, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = defaultOptions;
    }

    return this.request({ url, ...options }, callback);
}

Request.prototype.post = function post(url, options = defaultOptions, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = defaultOptions;
    }

    options.method = 'POST';
    return this.request({ url, ...options }, callback);
}

const request = Request.prototype.createClone();
module.exports = request;