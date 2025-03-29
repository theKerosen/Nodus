// src/handlers/interactionHandler.js
const util = require("util");
const { InteractionTypes, Constants } = require("nyowzers-lib");

/**
 * Handles incoming interactions.
 * @param {Client} client The Nyowzers Lib Client instance
 * @param {Interaction} interaction The interaction object received
 */
async function handleInteraction(client, interaction) {
    try {
        // --- Slash Command Handling ---
        if (interaction.isCommand()) {
            console.log(
                `Slash Command: ${interaction.commandName} by ${interaction.user.tag} in ${interaction.channelId}`,
            );
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(
                    `Interaction Error: No command matching ${interaction.commandName} was found.`,
                );
                if (!interaction.replied && !interaction.deferred) {
                    await interaction
                        .reply({
                            content:
                                "Error: This command seems to be missing or is not registered!",
                            ephemeral: true,
                        })
                        .catch(console.error);
                }
                return;
            }

            // Permission/Dev Check
            if (command.devOnly && interaction.user.id !== process.env.DEV_ID) {
                console.log(
                    `Interaction Denied: Dev command ${command.name} requested by ${interaction.user.tag}`,
                );
                if (!interaction.replied && !interaction.deferred) {
                    await interaction
                        .reply({
                            content:
                                "You do not have permission for this command.",
                            ephemeral: true,
                        })
                        .catch(console.error);
                }
                return;
            }

            try {
                if (typeof command.executeInteraction === "function") {
                    await command.executeInteraction(client, interaction);
                } else {
                    console.warn(
                        `Interaction Warning: Command ${command.name} has no 'executeInteraction' function.`,
                    );
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction
                            .reply({
                                content: `This command (${command.name}) cannot be used as a slash command currently.`,
                                ephemeral: true,
                            })
                            .catch(console.error);
                    }
                }
            } catch (error) {
                console.error(
                    `Error executing interaction command ${interaction.commandName}:`,
                    error,
                );
                const errorReply = {
                    content:
                        "There was an error trying to execute that command!",
                    ephemeral: true,
                };
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorReply);
                    } else {
                        await interaction.reply(errorReply);
                    }
                } catch (e) {
                    console.error(
                        "Interaction Error: Failed to send error reply:",
                        e,
                    );
                }
            }
        } else if (interaction.isButton()) {
            console.log(
                `Button Clicked: ${interaction.customId} by ${interaction.user.tag} (Possibly Unhandled Globally)`,
            );
        } else if (interaction.isSelectMenu()) {
            console.log(
                `Select Menu Used: ${interaction.customId} by ${interaction.user.tag} Values: ${interaction.values?.join(", ")} (Possibly Unhandled Globally)`,
            );
        } else if (interaction.isModalSubmit()) {
            console.log(
                `Modal Submitted: ${interaction.customId} by ${interaction.user.tag} (Unhandled Globally)`,
            );
            if (!interaction.replied && !interaction.deferred) {
                await interaction
                    .reply({
                        content: "Modal received (handler not implemented).",
                        ephemeral: true,
                    })
                    .catch(console.error);
            }
        } else if (interaction.isAutocomplete()) {
            console.log(
                `Autocomplete: Command=${interaction.commandName} Input='${interaction.options.getFocused(true).value}' by ${interaction.user.tag}`,
            );
            const command = client.commands.get(interaction.commandName);
            try {
                if (command && typeof command.autocomplete === "function") {
                    await command.autocomplete(client, interaction);
                } else {
                    await interaction.respond([]);
                }
            } catch (error) {
                console.error(
                    `Error handling autocomplete for ${interaction.commandName}:`,
                    error,
                );
                try {
                    await interaction.respond([]);
                } catch (error) {
                    console.error(`Error responding to message ${error}`);
                }
            }
        }
    } catch (error) {
        console.error("General error during interaction processing:", error);
    }
}

module.exports = handleInteraction;
