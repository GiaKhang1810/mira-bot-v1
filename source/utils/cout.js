'use strict';

const chalk = require('chalk');
const clock = require('./clock');

let interval = null;
let frameIndex = 0;
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function clearLine() {
    if (process.stdout.isTTY && typeof process.stdout.clearLine === 'function' && typeof process.stdout.cursorTo === 'function') {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    } else
        process.stdout.write('\n');
}

const load = (text, cycle = 80) => {
    if (interval)
        clearInterval(interval);

    frameIndex = 0;

    interval = setInterval(() => {
        const frame = frames[frameIndex = (frameIndex + 1) % frames.length];
        process.stdout.write('\r' + chalk.gray(clock.time('[ HH:mm:ss DD/MM/YYYY ] ')) + chalk.blue(frame + ' ' + text));
    }, cycle);
}

const success = text => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }

    clearLine();
    process.stdout.write('\r' + chalk.gray(clock.time('[ HH:mm:ss DD/MM/YYYY ] ')) + chalk.green('✔ ' + text) + '\n');
}

const fail = text => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }

    clearLine();
    process.stdout.write('\r' + chalk.gray(clock.time('[ HH:mm:ss DD/MM/YYYY ] ')) + chalk.red('✖ ' + text) + '\n');
}

const wall = (char = '=', lent = 15) => console.log(chalk.cyan(char.repeat(lent)));

const info = (name, text) =>
    console.log(chalk.gray(clock.time('[ HH:mm:ss DD/MM/YYYY ]')), chalk.green(name), text);

const warn = (name, text) =>
    console.log(chalk.gray(clock.time('[ HH:mm:ss DD/MM/YYYY ]')), chalk.yellow(name), text);

const error = (name, err) =>
    console.log(chalk.gray(clock.time('[ HH:mm:ss DD/MM/YYYY ]')), chalk.red(name), err instanceof Error ? err.message : err);

const cout = {
    load,
    success,
    fail,
    wall,
    info,
    warn,
    error
}

module.exports = cout;
