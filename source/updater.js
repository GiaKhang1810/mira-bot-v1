var uri = "https://raw.githubusercontent.com/GiaKhang1810/mira-bot-v1/main/";
var axios = require("axios");
var path = require("path");
var fs = require("fs");
var dir = path.resolve(__dirname, "..") + "/";
var log = require("./lib/log");
var { execSync } = require("child_process");
var changelog;

function getExtension(param) {
    var ext = path.extname(param).toLowerCase().split(".").pop();
    switch (ext) {
        case "json":
            return "json";
        case "js":
        case "css":
        case "ejs":
            return "text";
        default:
            return "binary";
    }
}

async function readChangelog() {
    var res = await axios.get(uri + "/changelog.json");
    changelog = res.data;
    fs.writeFileSync(dir + "/changelog.json", JSON.stringify(changelog, null, 4));
    changelog = changelog[Object.keys(changelog).pop()];
    return;
}

async function Writer() {
    for (var param in changelog) {
        var ext = getExtension(param);
        var url = uri + param;
        var res = await axios.get(url, { responseType: ext === "binary" ? "arraybuffer" : "text" });
        var data;
        var pathWrite = path.resolve(dir, param);
        var Dir = path.dirname(pathWrite);
        if (!fs.existsSync(Dir))
            fs.mkdirSync(Dir, { recursive: true });

        switch (ext) {
            case "json":
                data = JSON.stringify(JSON.parse(res.data), null, 4);
                break;
            case "text":
                data = res.data;
                break;
            default:
                data = Buffer.from(res.data, "utf-8");
                break;
        }
        fs.writeFileSync(pathWrite, data);
    }
    return;
}

async function finishedUpdate() {
    var url = uri + "package.json";
    var res = await axios.get(url);
    var data = JSON.stringify(res.data, null, 4);
    var pathWrite = path.resolve(dir, "package.json");
    fs.writeFileSync(pathWrite, data);
    execSync("npm install", {
        cwd: __dirname,
        stdio: "inherit",
        shell: true
    });
    return;
}

(async () => {
    try {
        await readChangelog();
        await Writer();
        await finishedUpdate();
        process.exit(2);
    } catch (error) {
        log.error("updater.error", error.message);
        console.log(error);
        return process.exit(1);
    }
})();
