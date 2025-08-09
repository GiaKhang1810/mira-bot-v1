'use strict';

const WebSocket = require('websocket-stream');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Client } = require('mqtt');

const { EventEmitter } = require('events');

const { isArray } = require('../../utils/type');

const topics = [
    '/legacy_web',
    '/webrtc',
    '/rtc_multi',
    '/onevc',
    '/br_sr',
    '/sr_res',
    '/t_ms',
    '/thread_typing',
    '/orca_typing_notifications',
    '/notify_disconnect',
    '/orca_presence',
    '/legacy_web_mtouch',
    '/t_rtc_multi',
    '/ls_foreground_state',
    '/ls_resp',
    '/inbox',
    '/mercury',
    '/messaging_events',
    '/orca_message_notifications',
    '/pp',
    '/webrtc_response',
    '/delivery_receipts',
    '/read_receipts',
    '/notifications_sync',
    '/fbns_msg',
    '/fbns_reg_resp',
    '/fbns_unreg_resp',
    '/fbns_connect',
    '/fbns_disconnect',
    '/fbns_ping',
    '/fbns_pong',
    '/mobile_requests',
    '/webrtc_stats',
    '/webrtc_relay',
    '/t_other',
    '/push_sync',
    '/presence',
    '/user_settings',
    '/orca_presence_updates',
    '/messenger_sync_create_queue',
    '/messenger_sync_get_diffs',
    '/messenger_sync_ack',
    '/capabilities',
    '/thread_reads',
    '/thread_activity',
    '/e2e_handshake',
    '/e2e_message',
    '/sync_sequence_id',
    '/sync_settings',
    '/sync_contacts',
];

function ListenWebSocket() {
    const { ctx, callback, utils } = this;
    const sessionID = Math.floor(Math.random() * 9007199254740991) + 1;
    const username = JSON.stringify({
        u: ctx.userID,
        s: sessionID,
        chat_on: true,
        fg: false,
        d: utils.generateUUID(),
        ct: 'websocket',
        aid: '219994525426954',
        mqtt_sid: '',
        cp: 3,
        ecp: 10,
        st: [],
        pm: [],
        dc: '',
        no_auto_fg: true,
        gas: null,
        pack: [],
        a: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        aids: null
    });

    const host = 'wss://edge-chat.messenger.com/chat?' + (ctx.region ? 'region=' + ctx.region.toLowerCase() + '&' : '') + 'sid=' + sessionID;
    const options = {
        clientId: 'mqttwsclient',
        protocolId: 'MQIsdp',
        protocolVersion: 3,
        username,
        clean: true,
        wsOptions: {
            headers: {
                'Cookie': ctx.jar.getCookie('https://www.messenger.com').map(i => i.name + '=' + i.value).join('; '),
                'Origin': 'https://www.messenger.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'Referer': 'https://www.messenger.com/',
                'Host': new URL(host).hostname
            },
            origin: 'https://www.messenger.com',
            protocolVersion: 13
        },
        keepalive: 10,
        reschedulePings: true
    }

    if (ctx.proxy) {
        const agent = new HttpsProxyAgent(ctx.proxy);
        options.wsOptions.agent = agent;
    }

    const client = new Client(function () {
        return WebSocket(host, options.wsOptions);
    }, options);

    ctx.client = client;

    client
        .on('error', function (error) {
            if (error.message === 'Invalid header flag bits, must be 0x0 for puback packet')
                return;

            ctx.client.end();
            delete ctx.client;

            callback({
                type: 'ListenWebSocket',
                message: error.message,
                error
            });
        });

    client
        .on('connect', function () {
            topics.forEach(topic => client.subscribe(topic, { qos: 1 }));

            let topic;
            const queue = {
                sync_api_version: 10,
                max_deltas_able_to_process: 1000,
                delta_batch_size: 500,
                encoding: 'JSON',
                entity_fbid: ctx.userID
            }

            if (ctx.syncToken) {
                topic = '/messenger_sync_get_diffs';
                queue.last_seq_id = ctx.lastSeqID;
                queue.sync_token = ctx.syncToken;
            } else {
                topic = '/messenger_sync_create_queue';
                queue.initial_titan_sequence_id = ctx.lastSeqID;
                queue.device_params = null;
            }

            client.publish(topic, JSON.stringify(queue), { qos: 1, retain: false });
            client.publish('/foreground_state', JSON.stringify({ foreground: true }), { qos: 1 });
            client.publish('/set_client_settings', JSON.stringify({ make_user_available_when_in_foreground: true }), { qos: 1 });
        });

    client
        .on('message', function (topic, message) {
            message = JSON.parse(Buffer.from(message).toString());

            callback(null, message);
        });
}

class Listener extends EventEmitter {
    constructor(ctx, core, utils) {
        super();

        this.ctx = ctx;
        this.core = core;
        this.utils = utils;
    }

    async connect(callback) {
        if (this.ctx.client)
            return;

        if (typeof callback !== 'function')
            this.callback = (error, message) => error ? this.emit('error', error) : this.emit('message', message);
        else 
            this.callback = callback;

        const body = {
            queries: JSON.stringify({
                o0: {
                    doc_id: '3336396659757871',
                    query_params: {
                        limit: 1,
                        before: null,
                        tags: ['INBOX'],
                        includeDeliveryReceipts: false,
                        includeSeqID: true
                    }
                }
            })
        }

        const response = await this.ctx.post('https://www.facebook.com/api/graphqlbatch/', { body });

        if (!isArray(response)) {
            this.callback({
                type: 'Logout',
                message: 'Session expired or invalid authentication. Please log in again.',
                response
            });

            return;
        }

        const index = response.length - 1;

        if (response[index].error_results > 0) {
            this.callback({
                type: 'getSeqID',
                message: response[0]?.o0?.errors?.[0]?.message,
                error: response[0]?.o0?.errors
            });

            return;
        }

        if (response[index].successful_results === 0) {
            this.callback({
                type: 'getSeqID',
                message: 'there was no successful_results',
                response
            });

            return;
        }

        if (response[0]?.o0.data?.viewer?.message_threads?.sync_sequence_id) {
            this.ctx.lastSeqID = response[0].o0.data.viewer.message_threads.sync_sequence_id;

            return ListenWebSocket.bind(this)();
        } else {
            this.callback({
                type: 'getSeqID',
                message: 'can not find sequence id',
                response
            });

            return;
        }
    }

    disconnect() {
        if (this.ctx.client) {
            this.ctx.client.end();
            delete this.ctx.client;
        }

        this.callback(null, {
            type: 'disconnect',
            message: 'Disconnect successfully'
        });
    }

    reconnect() {
        if (this.ctx.client) {
            this.ctx.client.end();
            delete this.ctx.client;
        }

        this.connect(this.callback);
    }
}

module.exports = function (ctx, core, utils) {
    return new Listener(ctx, core, utils);
}