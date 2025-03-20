const { Message } = require("./message");

class Interaction {
    constructor(data, discordLib) {
        this.discordLib = discordLib;
        this.id = data.id;
        this.applicationId = data.application_id;
        this.type = data.type;
        this.data = data.data;
        this.guildId = data.guild_id;
        this.channelId = data.channel_id;
        this.user = data.member ? data.member.user : data.user;
        this.token = data.token;
        this.version = data.version;
        this.message = new Message(data.message, discordLib);
    }

    async reply({ content = "", embeds = [], components = [] }) {
        const response = await this.discordLib.request(
            this.discordLib.token,
            "POST",
            `/interactions/${this.id}/${this.token}/callback`,
            { type: 4, data: { content, embeds, components } },
        );
        return response;
    }

    async defer() {
        const response = await this.discordLib.request(
            this.discordLib.token,
            "POST",
            `/interactions/${this.id}/${this.token}/callback`,
            { type: 6 },
        );
        return response;
    }

    async update({ content = "", embeds = [], components = [] }) {
        const response = await this.discordLib.request(
            this.discordLib.token,
            "PATCH",
            `/channels/${this.channelId}/messages/${this.message.id}`,
            { content, embeds, components },
        );
        return response;
    }
}

module.exports = { Interaction };
