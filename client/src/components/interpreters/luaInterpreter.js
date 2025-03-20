const fs = require("fs");
const path = require("path");

class LuaHandler {
    constructor(scriptsDir) {
        this.scriptsDir = scriptsDir;
        this.luaFiles = [];
    }

    loadLuaFiles() {
        if (this.luaFiles.length > 0) this.luaFiles.length = 0;

        this.luaFiles = fs
            .readdirSync(this.scriptsDir)
            .filter((file) => file.endsWith(".lua"));
        if (this.luaFiles.length === 0) {
            console.error("No Lua files found in the scripts directory");
            process.exit(1);
        }
    }

    getTaskPath(luaFile) {
        return path.join(this.scriptsDir, luaFile);
    }

    getTaskBody(luaFile) {
        const filePath = this.getTaskPath(luaFile);
        return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    }
}

module.exports = LuaHandler;
