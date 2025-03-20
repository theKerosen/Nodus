const EventEmitter = require("events");
const LuaHandler = require("../interpreters/luaInterpreter");
const { connectToGateway } = require("./gateway/connectToGateway");
const startHeartbeat = require("./gateway/startHeartbeat");
const sendIdentifyPayload = require("./gateway/sendIdentifyPayload");
const TickrateClient = require("../clients/tickrateClient");
const { Message } = require("../objects/message");
const { Channel } = require("../objects/channel");
const { Interaction } = require("../objects/interaction");

class DiscordLib extends EventEmitter {
    constructor(token) {
        super();
        this.token = token;
        this.commands = new Map();
        this.channels = new Map();
        this.guilds = new Map();
        this.messages = new Map();
        this.statusDataMap = new Map();
        this.messageExpiryTime = 400000;
        this.baseUrl = "https://discord.com/api/v10";
        this.prefix = "!";
        this.gatewayUrl = null;
        this.gatewayWs = null;
        this.heartbeatInterval = null;
        this.luaHandler = new LuaHandler(process.env.SCRIPTS_DIR);
        this.tickrateClient = new TickrateClient(
            process.env.TICKRATE_HOST,
            process.env.TICKRATE_PORT,
        );
        this.loadLuaScripts();
        this.listenerAdded = false;
    }

    loadLuaScripts() {
        this.luaHandler.loadLuaFiles();
    }

    async login() {
        try {
            const user = await this.request(this.token, "GET", "/users/@me");
            if (!user || user.error || (user.type === "error" && user.data)) {
                throw new Error(
                    `Failed to authenticate with Discord API: ${user?.data?.message || "Unknown error"}`,
                );
            }
            console.log(`Logged in as ${user.username}#${user.discriminator}`);
            this.emit("ready");
        } catch (error) {
            console.error("Login failed:", error.message);
            throw error;
        }
    }

    async gateway() {
        try {
            const gatewayData = await this.request(
                this.token,
                "GET",
                "/gateway",
            );
            if (
                !gatewayData.url ||
                (gatewayData.type === "error" && gatewayData.data)
            ) {
                throw new Error(
                    `Failed to get gateway URL: ${gatewayData?.data?.message || "Unknown error"}`,
                );
            }
            this.gatewayUrl = gatewayData.url;

            this.gatewayWs = connectToGateway(this.token, this.gatewayUrl, {
                startHeartbeat: (ws, interval) => {
                    this.heartbeatInterval = startHeartbeat(ws, interval);
                },
                sendIdentifyPayload: (ws, token) =>
                    sendIdentifyPayload(ws, token),
                emit: (event, data) => this.emit(event, data),
            });

            if (!this.listenerAdded) {
                this.gatewayWs.on("message", async (data) => {
                    try {
                        const payload = JSON.parse(data);
                        if (payload.t === "MESSAGE_CREATE") {
                            const message = new Message(payload.d, this);
                            this.messages.set(message.id, message);
                        } else if (payload.t === "INTERACTION_CREATE") {
                            const interaction = new Interaction(
                                payload.d,
                                this,
                            );
                            this.emit("interactionCreate", interaction);
                        }
                    } catch (err) {
                        console.error(
                            "Failed to process gateway message:",
                            err,
                        );
                    }
                });
                this.listenerAdded = true;
            }

            setInterval(() => {
                const now = Date.now();
                this.messages.forEach((value, key) => {
                    if (now - value.timestamp > this.messageExpiryTime) {
                        this.messages.delete(key);
                    }
                });
            }, this.messageExpiryTime);
        } catch (error) {
            console.error("Gateway connection failed:", error.message);
            throw error;
        }
    }

    async updateStatusData() {
        try {
            const luaFile = process.env.CS_API_SCRIPT;
            const taskFilePath = this.luaHandler.getTaskPath(luaFile);
            const customArgs = { url: process.env.CS_API_URL };

            this.latestStatusData = await new Promise((resolve, reject) => {
                this.tickrateClient.runLuaTask(
                    luaFile,
                    taskFilePath,
                    customArgs,
                    (response) => {
                        if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response);
                        }
                    },
                );
            });
        } catch (error) {
            console.error("Error updating status data:", error.message);
            this.latestStatusData = null;
        }
    }

    async request(token, method, endpoint, body) {
        const luaFile = "api_request.lua";
        const taskFilePath = this.luaHandler.getTaskPath(luaFile);
        const customArgs = { token, method, endpoint, body };

        return new Promise((resolve, reject) => {
            this.tickrateClient.runLuaTask(
                luaFile,
                taskFilePath,
                customArgs,
                (response) => {
                    try {
                        if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(JSON.parse(response));
                        }
                    } catch (e) {
                        reject(
                            new Error(
                                `Failed to process response: ${e.message}`,
                            ),
                        );
                    }
                },
            );
        });
    }

    async fetch_guilds() {
        try {
            const response = await this.request(
                this.token,
                "GET",
                "/users/@me/guilds",
            );

            if (!Array.isArray(response)) {
                console.error(
                    "Unexpected response format from /users/@me/guilds:",
                    response,
                );
                throw new Error(
                    "Failed to fetch guilds: Invalid response format.",
                );
            }

            this.guilds.clear();
            response.forEach((guildData) => {
                this.guilds.set(guildData.id, guildData);
            });

            console.log(`Fetched ${this.guilds.size} guild(s).`);
            return response;
        } catch (error) {
            console.error("Error fetching guilds:", error.message);
            throw new Error(
                "Failed to fetch guilds. Ensure the token has the necessary permissions.",
            );
        }
    }

    async fetch_channels() {
        try {
            for (let [guildId] of this.guilds) {
                const response = await this.request(
                    this.token,
                    "GET",
                    `/guilds/${guildId}/channels`,
                );

                if (!Array.isArray(response)) {
                    console.error(
                        `Unexpected response format from /guilds/${guildId}/channels:`,
                        response,
                    );
                    continue;
                }

                response.forEach((channelData) => {
                    const channel = new Channel(channelData, this);
                    this.channels.set(channel.id, channel);
                });
            }

            console.log(
                `Fetched ${this.channels.size} channel(s) across all guilds.`,
            );
        } catch (error) {
            console.error("Error fetching channels:", error.message);
            throw new Error(
                "Failed to fetch channels. Ensure the token has the necessary permissions.",
            );
        }
    }
}

module.exports = DiscordLib;
