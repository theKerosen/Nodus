const { Message } = require("../components/objects/message");
const CommandLoader = require("../components/loaders/commandLoader");

module.exports = (bot) => {
    bot.on("messageCreate", (data) => {
        const prefix = bot.prefix || "!";

        const message = new Message(data, bot);
        if (!message.content.startsWith(prefix) || message.author.bot) return;

        CommandLoader.executeCommand(bot, message);
    });
};
