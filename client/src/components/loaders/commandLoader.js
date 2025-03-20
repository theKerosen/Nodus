const fs = require("fs");
const path = require("path");
const { Message } = require("../objects/message");
const { Interaction } = require("../objects/interaction");

class CommandLoader {
    /**
     * A map to track cooldowns for users.
     * Key: `${userId}-${commandName}`
     * Value: Timestamp of the last execution
     */
    static cooldowns = new Map();

    /**
     * Loads all commands from the commands directory into the bot's command map.
     * @param {Object} bot - The bot instance.
     */
    static loadCommands(bot) {
        if (bot.commands instanceof Map && bot.commands.size > 0) {
            bot.commands.clear();
        }

        const commandsDir = path.join(__dirname, "..", "..", "commands");
        fs.readdirSync(commandsDir).forEach((file) => {
            if (file.endsWith(".js")) {
                const command = require(path.join(commandsDir, file));

                bot.commands.set(command.name, command);

                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach((alias) => {
                        bot.commands.set(alias, command);
                    });
                }
            }
        });
    }

    /**
     * Executes a command based on the user's input.
     * @param {Object} bot - The bot instance.
     * @param {Message} context - The message context.
     */
    static async executeCommand(bot, context) {
        const args = context.content
            .slice(bot.prefix.length)
            .trim()
            .split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        const subcommandName = args.shift()?.toLowerCase();
        const command = bot.commands.get(commandName);

        if (!command) return;

        const canonicalCommandName = command.name;
        context.usedAlias = command.aliases?.includes(commandName)
            ? commandName
            : null;

        if (command.devOnly && context.author.id !== process.env.DEV_ID) {
            return context.reply(
                "Você não tem permissão para usar este comando.",
            );
        }

        const cooldownKey = `${context.author.id}-${canonicalCommandName}`;
        const cooldownDuration = command.cooldown || 0;
        const lastExecutionTime = this.cooldowns.get(cooldownKey);

        if (
            lastExecutionTime &&
            Date.now() - lastExecutionTime < cooldownDuration
        ) {
            const remainingCooldown = Math.ceil(
                (cooldownDuration - (Date.now() - lastExecutionTime)) / 1000,
            );
            return await context.reply(
                `Por favor, aguarde ${remainingCooldown} segundo(s) antes de usar este comando novamente.`,
            );
        }

        this.cooldowns.set(cooldownKey, Date.now());

        if (!subcommandName && !command.execute) {
            if (command.subcommands) {
                const subcommandList = Object.entries(command.subcommands)
                    .map(([name, subcommand]) => {
                        const aliases = subcommand.aliases
                            ? ` (${subcommand.aliases.join(", ")})`
                            : "";
                        return `- \`${name}${aliases}\``;
                    })
                    .join("\n");
                return context.reply(
                    `Subcomandos disponíveis:\n${subcommandList}`,
                );
            }
            return context.reply("Este comando requer um subcomando.");
        }

        if (command.init) {
            try {
                await command.init(context, bot);
            } catch (error) {
                console.error(
                    `[ERROR] Init failed for ${canonicalCommandName}:`,
                    error,
                );
                return context.reply("Houve um erro ao preparar este comando.");
            }
        }

        if (subcommandName && command.subcommands) {
            const subcommand =
                command.subcommands[subcommandName] ||
                Object.values(command.subcommands).find((s) =>
                    s.aliases?.includes(subcommandName),
                );

            if (!subcommand) {
                return context.reply("Subcomando desconhecido.");
            }

            const canonicalSubcommandName = subcommand.name || subcommandName;
            context.subcommandUsedAlias = subcommand.aliases?.includes(
                subcommandName,
            )
                ? subcommandName
                : null;

            if (
                subcommand.devOnly &&
                context.author.id !== process.env.DEV_ID
            ) {
                return await context.reply(
                    "Você não tem permissão para usar este subcomando.",
                );
            }

            const subcommandCooldownKey = `${context.author.id}-${canonicalCommandName}-${canonicalSubcommandName}`;
            const subcommandCooldownDuration = subcommand.cooldown || 0;
            const subcommandLastExecutionTime = this.cooldowns.get(
                subcommandCooldownKey,
            );

            if (
                subcommandLastExecutionTime &&
                Date.now() - subcommandLastExecutionTime <
                    subcommandCooldownDuration
            ) {
                const remainingCooldown = Math.ceil(
                    (subcommandCooldownDuration -
                        (Date.now() - subcommandLastExecutionTime)) /
                        1000,
                );
                return await context.reply(
                    `Por favor, aguarde ${remainingCooldown} segundos antes de usar este subcomando novamente.`,
                );
            }

            this.cooldowns.set(subcommandCooldownKey, Date.now());
            const result = await subcommand.execute(bot, context, args);
            return result;
        }

        if (command.execute) {
            return await command.execute(bot, context, args);
        }
    }
}

module.exports = CommandLoader;
