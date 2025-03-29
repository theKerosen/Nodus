require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { Client, Events, Intents, Collection } = require("nyowzers-lib");

const LuaHandler = require("../src/components/interpreters/luaInterpreter");
const TickrateClient = require("../src/components/clients/tickrateClient");
const handleCommand = require("../src/handlers/commandHandler");
const handleInteraction = require("../src/handlers/interactionHandler");
const {
    updateAndCheckStatus,
    initializeStatusState,
} = require("../src/features/csStatus");

class Bot {
    constructor() {
        console.log("Initializing Bot class...");
        this.client = new Client({
            token: process.env.DISCORD_TOKEN,
            intents: [
                Intents.Flags.GUILDS,
                Intents.Flags.GUILD_MESSAGES,
                Intents.Flags.MESSAGE_CONTENT,
            ],
        });
        this.luaHandler = new LuaHandler(path.join(__dirname, "..", "scripts"));
        this.tickrateClient = new TickrateClient(
            process.env.TICKRATE_HOST,
            process.env.TICKRATE_PORT,
        );
        this.client.commands = new Collection();
        this.client.cooldowns = new Collection();
        this.client.statusDataMap = new Map();
        this.statusState = initializeStatusState();
    }

    loadCommands() {
        console.log("Loading commands...");
        try {
            const commandsPath = path.join(__dirname, "..", "src", "commands");
            const commandFiles = fs
                .readdirSync(commandsPath)
                .filter((file) => file.endsWith(".js"));
            console.log(`Found ${commandFiles.length} command files.`);
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                try {
                    const command = require(filePath);
                    if (
                        command.name &&
                        (command.execute || command.subcommands)
                    ) {
                        this.client.commands.set(
                            command.name.toLowerCase(),
                            command,
                        );
                        console.log(`Loaded command: ${command.name}`);
                        if (command.aliases && Array.isArray(command.aliases)) {
                            command.aliases.forEach((alias) => {
                                this.client.commands.set(
                                    alias.toLowerCase(),
                                    command,
                                );
                                console.log(
                                    `  -> Alias loaded: ${alias} -> ${command.name}`,
                                );
                            });
                        }
                    } else {
                        console.warn(
                            `[WARNING] Command file ${file} is invalid.`,
                        );
                    }
                } catch (error) {
                    console.error(`Error loading command file ${file}:`, error);
                }
            }
        } catch (error) {
            console.error("Could not read commands directory:", error);
        }
    }

    registerEventHandlers() {
        console.log("Registering event handlers...");
        this.client.once(Events.READY, async () => {
            console.log(`Ready! Logged in as ${this.client.user.tag}`);
            console.log(
                `Client has ${this.client.guilds.cache.size} guilds cached.`,
            );
            try {
                this.luaHandler.loadLuaFiles();
                console.log("Lua files loaded by handler.");
                await updateAndCheckStatus(
                    this.client,
                    this.tickrateClient,
                    this.luaHandler,
                    this.statusState,
                );
                setInterval(
                    () =>
                        updateAndCheckStatus(
                            this.client,
                            this.tickrateClient,
                            this.luaHandler,
                            this.statusState,
                        ),
                    parseInt(process.env.STATUS_INTERVAL || "120000", 10),
                );
            } catch (error) {
                console.error("Error during READY initialization:", error);
            }
        });

        this.client.on(Events.MESSAGE_CREATE, async (message) => {
            await handleCommand(this.client, message);
        });

        this.client.on(Events.INTERACTION_CREATE, async (interaction) => {
            await handleInteraction(this.client, interaction);
        });

        this.client.on(Events.ERROR, (error) =>
            console.error("Client encountered an error:", error),
        );
        this.client.on(Events.WARN, (warning) =>
            console.warn("Client warning:", warning),
        );
    }

    start() {
        console.log("Starting bot...");
        this.loadCommands();
        this.registerEventHandlers();
        console.log("Logging in...");
        this.client.login();
    }
}

module.exports = Bot;
