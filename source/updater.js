'use strict';

const { execSync, spawnSync } = require('child_process');
const { resolve } = require('path');
const { existsSync, rmSync, statSync, readdirSync, mkdirSync, copyFileSync } = require('fs');
const { tmpdir } = require('os');

const cout = require('./utils/cout');
const request = require('./utils/request');

const { version } = require('../package.json');

const cwd = process.cwd();
const repo = 'https://github.com/GiaKhang1810/mira-bot-v1.git';
const tempClone = resolve(tmpdir(), 'mira-bot-v1-latest');
const backupDir = resolve(cwd, '.backup');

function isHigherOrEqualVersion(current, target) {
    const cParts = current.split('.').map(Number);
    const tParts = target.split('.').map(Number);
    const length = Math.max(cParts.length, tParts.length);

    for (let i = 0; i < length; i++) {
        const cPart = cParts[i] ?? 0;
        const tPart = tParts[i] ?? 0;

        if (cPart < tPart)
            return false;
        if (cPart > tPart)
            return true;
    }

    return true;
}

async function getVersionCurrent() {
    const response = await request.get('https://raw.githubusercontent.com/GiaKhang1810/mira-bot-v1/refs/heads/main/package.json');
    const version = response.body?.version;

    if (version)
        return version;

    throw new Error('Unable to get latest version information on github.');
}

async function checkGit() {
    const git = spawnSync('git', ['--version']);

    if (git.error || git.status !== 0) {
        cout.warn('Updater', 'Git is not installed.');
        cout.warn('Updater', 'Please install Git before continuing: https://git-scm.com/downloads');
        return false;
    }

    return true;
}

async function copyRecursive(src, dest) {
    if (!existsSync(src)) return;

    const stat = statSync(src);

    if (stat.isDirectory()) {
        mkdirSync(dest, { recursive: true });

        for (const file of readdirSync(src))
            await copyRecursive(resolve(src, file), resolve(dest, file));
    } else {
        mkdirSync(resolve(dest, '..'), { recursive: true });
        copyFileSync(src, dest);
    }
}

async function createBackup() {
    rmSync(backupDir, { recursive: true, force: true });

    const backups = ['source', 'package.json', '.gitignore', 'README.md', 'LICENSE', 'plugins'];

    for (let fileOrDir of backups) {
        const src = resolve(cwd, fileOrDir);
        const dest = resolve(backupDir, fileOrDir);

        if (existsSync(src))
            await copyRecursive(src, dest);
    }

    cout.info('Updater', 'Backup created at .backup/');
}

async function restoreBackup() {
    const fileOrDirRestore = readdirSync(backupDir);

    for (const fileOrDir of fileOrDirRestore)
        await copyRecursive(resolve(backupDir, fileOrDir), resolve(cwd, fileOrDir));

    cout.info('Updater', 'Restore completed.');
}

async function initGit() {
    if (existsSync(resolve(cwd, '.git')))
        return;

    cout.info('Updater', 'Initializing Git repository...');
    execSync('git init', { cwd, stdio: 'ignore' });
    execSync('git add .', { cwd, stdio: 'ignore' });
    execSync('git commit -m "Initial backup before update"', { cwd, stdio: 'ignore' });
}

async function updateAndRestart() {
    try {
        await createBackup();
        await initGit();

        rmSync(tempClone, { recursive: true, force: true });
        execSync(`git clone --depth=1 ${repo} "${tempClone}"`, { stdio: 'ignore' });

        const fileOrDirUpdate = ['source', 'package.json', '.gitignore', 'README.md', 'LICENSE', 'plugins'];
        for (const fileOrDir of fileOrDirUpdate) {
            const src = resolve(tempClone, fileOrDir);
            const dest = resolve(cwd, fileOrDir);
            if (existsSync(src)) {
                rmSync(dest, { recursive: true, force: true });
                await copyRecursive(src, dest);
            }
        }

        rmSync(backupDir, { recursive: true, force: true });
        rmSync(tempClone, { recursive: true, force: true });

        cout.success('Updated successfully.');
        cout.wall('=', 100);
        process.exit(0);
    } catch (error) {
        cout.fail('Update failed.');
        cout.error('Updater', error);

        cout.warn('Updater', 'Restoring from backup...');
        if (existsSync(backupDir))
            await restoreBackup();
        else
            cout.warn('Updater', 'No backup available to restore.');

        rmSync(backupDir, { recursive: true, force: true });
        rmSync(tempClone, { recursive: true, force: true });

        cout.wall('=', 100);
        process.exit(1);
    }
}

async function checkAndUpdate() {
    try {
        cout.info('Updater', 'Running on version ' + version);

        const versionCurrent = await getVersionCurrent();

        if (isHigherOrEqualVersion(version, versionCurrent))
            return;

        cout.info('Updater', 'Version ' + versionCurrent + ' is available. Refer to ' + repo);

        if (process.env.AUTO_UPDATE === 'true') {
            if (!(await checkGit()))
                return;

            cout.warn('Updater', 'System update in progress. Please do not exit the program until complete!');
            cout.load('Updating system...');
            await updateAndRestart();
        }
    } catch (error) {
        cout.warn('Updater', 'Unable to check/update system.');
        cout.error('Updater', error);
    }
}

module.exports = checkAndUpdate;