'use strict';

const { fork } = require('child_process');
const { join } = require('path');
const cout = require('./utils/cout');

function getEnvConfig() {
    const systemConfig = require('../config.json').system;

    const mergedConfig = process.env;
    mergedConfig.PORT = systemConfig.port || 3000;
    mergedConfig.TIMEZONE = systemConfig.time_zone || 'Asia/Ho_Chi_Minh';
    mergedConfig.LOCALE = systemConfig.locale || 'vi-VN';
    mergedConfig.AUTO_UPDATE = !!systemConfig.auto_update.toString();

    return mergedConfig;
}

function startWorker(firstRun = true) {
    cout.wall('=', 100);
    cout.info('System', firstRun ? 'Starting worker...' : 'Restarting worker...');

    const workerPath = join(__dirname, 'main.js');
    const forkOptions = {
        env: getEnvConfig(),
        stdio: 'inherit',
        shell: true
    }
    const worker = fork(workerPath, forkOptions);

    worker.on('exit', code => {
        if (code === 0)
            cout.info('System', 'Worker exited successfully.');
        else if (code === 1)
            cout.error('System', 'Worker exited with an error.');
        else {
            cout.info('System', `Worker exited with code ${code}. Restarting...`);
            console.clear();
            setTimeout(startWorker, 5000, false);
        }
    });
}
startWorker();