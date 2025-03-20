require("dotenv").config();
const DiscordLib = require("./components/lib/discordLib");
const HandlerLoader = require("./components/loaders/handlerLoader");
const CommandLoader = require("./components/loaders/commandLoader");

const bot = new DiscordLib(process.env.DISCORD_TOKEN);

HandlerLoader.loadHandlers(bot);
CommandLoader.loadCommands(bot);

bot.login();
