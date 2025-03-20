const { EmbedBuilder } = require("../components/builders/embedBuilder");

module.exports = {
  name: "embed",
  devOnly: true,
  execute: async (bot, message, args) => {
    const embed = new EmbedBuilder()
      .setTitle("Lorem Ipsum")
      .setDescription(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
      )
      .setColor(0x00ff00)
      .addField("Field 1", "Value 1", true)
      .addField("Field 2", "Value 2", true)
      .setFooter("Placeholder", "")
      .setImage("")
      .setThumbnail("")
      .build();

    await message.reply({ content: "this is an embed", embeds: [embed] });
  },
};
