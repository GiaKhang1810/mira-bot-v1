'use strict';

const { createHash } = require('crypto');
const { Readable } = require('stream');

const ANDROID_DEVICES = [
    { model: 'Pixel 6', build: 'SP2A.220505.002' },
    { model: 'Pixel 5', build: 'RQ3A.210805.001.A1' },
    { model: 'Samsung Galaxy S21', build: 'G991USQU4AUDA' },
    { model: 'OnePlus 9', build: 'LE2115_11_C.48' },
    { model: 'Xiaomi Mi 11', build: 'RKQ1.200826.002' }
];

function randomDevice() {
    const device = ANDROID_DEVICES[Math.floor(Math.random() * ANDROID_DEVICES.length)];

    return {
        userAgent: 'Dalvik/2.1.0 (Linux; U; Android 11; ' + device.model + ' Build/' + device.build,
        device
    }
}

function randomString(length = 10) {
    const char = 'abcdefghijklmnopqrstuvwxyz';
    let output = char.charAt(Math.floor(Math.random() * char.length));
    for (let i = 0; i < length - 1; i++)
        output += char.charAt(Math.floor(36 * Math.random()));

    return output;
}

function encodeSig(sig) {
    let data = '';
    Object.keys(sig).forEach(key => data += key + '=' + sig[key]);
    return createHash('md5').update(data + '62f8ce9f74b12f84c123cc23437a4a32').digest('hex');
}

function sortSig(sig) {
    const sorted = Object.keys(sig).sort();
    const sortedData = {}

    for (let key of sorted)
        sortedData[key] = sig[key];

    return sortedData;
}

function makeDefaults(params, request) {
    function merge(body) {
        const newObj = {
            ...params
        }

        if (!body)
            return newObj;

        for (const prop in body)
            if (!newObj[prop])
                newObj[prop] = body[prop];

        return newObj;
    }

    function post(url, options) {
        options.body = merge(options.body);
        options.query = merge(options.query);

        options.headers = {
            'Content-Type': 'multipart/form-data'
        }
        return request.post(url, options);
    }

    function get(url, options) {
        options.query = merge(options.query);
        return request.get(url, options);
    }

    return {
        post,
        get
    }
}

function isReadableStream(stream) {
    return (
        stream instanceof Readable &&
        typeof stream.pipe === 'function' &&
        typeof stream.read === 'function'
    );
}

function checkLiveCookie(request) {
    return request
        .get('https://business.facebook.com/')
        .then(response => {
            const body = response.body;
            return !!body.match(/"DTSGInitData",\[],\{"token":"([^"]+)",/);
        })
        .catch(function () {
            return false;
        });
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        (c === 'x' ? Math.random() * 16 | 0 : (Math.random() * 4 | 8)).toString(16)
    );
}

function extractParameters(body, userID) {
    let reqCounter = 1;
    const fb_dtsg = body.match(/"DTSGInitData",\[],\{"token":"([^"]+)",/)[1];
    const lsd = body.match(/"LSD",\[],\{"token":"([^"]+)"\}/)[1];
    const revision = /"server_revision":(\d+)/g.exec(body)[1];
    const hsi = /"hsi":"(\d+)"/g.exec(body)[1];
    let ttstamp = '2';
    for (let i = 0; i < fb_dtsg.length; i++)
        ttstamp += fb_dtsg.charCodeAt(i);

    const params = {
        __aaid: 0,
        av: userID,
        __user: userID,
        __req: (reqCounter++).toString(36),
        __rev: revision,
        __a: 1,
        lsd,
        hsi,
        dpr: 1,
        fb_dtsg,
        jazoest: ttstamp,
        __comet_req: 15,
        __spin_r: revision,
        __spin_t: Math.floor(Date.now() / 1000),
        __spin_b: 'trunk',
    }

    return params;
}

module.exports = {
    randomDevice,
    randomString,
    encodeSig,
    sortSig,
    makeDefaults,
    isReadableStream,
    checkLiveCookie,
    generateUUID,
    extractParameters
}