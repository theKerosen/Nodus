// commands/embed.js
const { EmbedBuilder } = require("nyowzers-lib");

module.exports = {
    name: "embed",
    devOnly: true,
    execute: async (client, message, args) => {
        const embed = new EmbedBuilder()
            .setTitle("Lorem Ipsum")
            .setDescription("test")
            .setColor(0x00ff00)
            .addField("Field 1", "Value 1", true)
            .addField("Field 2", "Value 2", true)
            .setFooter({ text: "Placeholder" });

        try {
            await message.reply({
                content: "this is an embed",
                embeds: [embed.toJSON()],
            });
        } catch (error) {
            console.error("Failed to send embed reply:", error);
            message.channel.send("Failed to send embed.").catch(console.error);
        }
    },
};
