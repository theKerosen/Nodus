const { Collection, ChannelTypes } = require("nyowzers-lib");
const util = require("util");

const DEFAULT_PREFIX = "!";

/**
 * Handles incoming messages to execute commands.
 * @param {Client} client The Nyowzers Lib Client instance
 * @param {Message} message The message object received
 */
async function handleCommand(client, message) {
    if (!message || message.author.bot || !message.guild) return;

    const prefix = process.env.PREFIX || DEFAULT_PREFIX;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) {
        return;
    }

    if (message.channel.type == ChannelTypes.GUILD_TEXT)
        message.channel.sendTyping();

    if (command.devOnly && message.author.id !== process.env.DEV_ID) {
        console.log(
            `Denied dev command ${command.name} to ${message.author.tag}`,
        );

        return;
    }

    if (!client.cooldowns) client.cooldowns = new Collection();

    const now = Date.now();
    let executedCommandName = command.name;
    let cooldownAmount = (command.cooldown || 3) * 1000;

    let subCommand = null;
    let subCommandName = null;
    if (command.subcommands && args.length > 0) {
        subCommandName = args[0].toLowerCase();
        subCommand = command.subcommands[subCommandName];
        if (!subCommand) {
            for (const sc of Object.values(command.subcommands)) {
                if (sc.aliases && sc.aliases.includes(subCommandName)) {
                    subCommand = sc;

                    cooldownAmount =
                        (subCommand.cooldown || command.cooldown || 3) * 1000;
                    break;
                }
            }
        } else {
            cooldownAmount =
                (subCommand.cooldown || command.cooldown || 3) * 1000;
        }
    }

    if (!client.cooldowns.has(executedCommandName)) {
        client.cooldowns.set(executedCommandName, new Collection());
    }
    const timestamps = client.cooldowns.get(executedCommandName);

    if (timestamps.has(message.author.id)) {
        const expirationTime =
            timestamps.get(message.author.id) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            try {
                await message.react("⏳").catch(() => {});
            } catch (reactError) {
                console.warn(
                    "Failed to react with cooldown emoji",
                    reactError.message,
                );
            }
            return;
        }
    }

    try {
        console.log(
            `Executing command: ${command.name} ${subCommandName ? `(${subCommandName})` : ""} for ${message.author.tag}`,
        );
        let executedSubcommand = false;

        if (subCommand?.execute) {
            if (
                subCommand.devOnly &&
                message.author.id !== process.env.DEV_ID
            ) {
                return;
            }
            await subCommand.execute(client, message, args.slice(1));
            executedSubcommand = true;
        } else if (subCommand) {
            message
                .reply(
                    `Subcommand "${subCommandName}" is not fully implemented.`,
                )
                .catch(console.error);
            executedSubcommand = true;
        }

        if (!executedSubcommand && command.execute) {
            await command.execute(client, message, args);
        } else if (
            !executedSubcommand &&
            command.subcommands &&
            args.length === 0
        ) {
            message
                .reply(
                    `Usage: ${prefix}${command.name} <subcommand>\nAvailable: ${Object.keys(command.subcommands).join(", ")}`,
                )
                .catch(console.error);
        } else if (
            !executedSubcommand &&
            !command.execute &&
            command.subcommands &&
            args.length > 0 &&
            !subCommand
        ) {
            message
                .reply(
                    `Invalid subcommand "${args[0]}". Available: ${Object.keys(command.subcommands).join(", ")}`,
                )
                .catch(console.error);
        } else if (
            !executedSubcommand &&
            !command.execute &&
            !command.subcommands
        ) {
            console.warn(
                `Command ${command.name} is invalid (no execute/subcommands).`,
            );
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    } catch (error) {
        console.error(
            `Error during command execution (${command.name}):`,
            util.inspect(error, { depth: 3 }),
        );
        message
            .reply("Oops! Something went wrong while running that command.")
            .catch(console.error);
    }
}

module.exports = handleCommand;
