const EventEmitter = require("events");

class Message {
    constructor(data, discordLib) {
        this.discordLib = discordLib;
        this.reactions = data.reactions || [];
        this.attachments = data.attachments || [];
        this.tts = data.tts || false;
        this.embeds = data.embeds || [];
        this.timestamp = data.timestamp || "";
        this.mentionEveryone = data.mention_everyone || false;
        this.id = data.id || "";
        this.pinned = data.pinned || false;
        this.editedTimestamp = data.edited_timestamp || null;
        this.author = data.author ? new User(data.author) : null;
        this.mentionRoles = data.mention_roles || [];
        this.content = data.content || "";
        this.channelId = data.channel_id || "";
        this.mentions = data.mentions || [];
        this.type = data.type || 0;
        this.channel = this.discordLib.channels.get(this.channelId) || null;
    }

    async edit(arg) {
        let content = "",
            embeds = [],
            components = [];

        if (typeof arg === "string") {
            content = arg;
        } else if (typeof arg === "object" && arg !== null) {
            ({ content = "", embeds = [], components = [] } = arg);
        } else {
            throw new Error(
                "Invalid argument type. Expected a string or an object.",
            );
        }

        const response = await this.discordLib.request(
            this.discordLib.token,
            "PATCH",
            `/channels/${this.channelId}/messages/${this.id}`,
            {
                content: content,
                embeds: embeds,
                components: components,
            },
        );

        Object.assign(this, response);
    }

    async delete() {
        await this.discordLib.request(
            this.discordLib.token,
            "DELETE",
            `/channels/${this.channelId}/messages/${this.id}`,
        );
    }

    async react(emoji) {
        await this.discordLib.request(
            this.discordLib.token,
            "PUT",
            `/channels/${this.channelId}/messages/${this.id}/reactions/${encodeURIComponent(emoji)}/@me`,
        );
    }

    async reply(arg) {
        let content = "",
            embeds = [],
            components = [];

        if (typeof arg === "string") {
            content = arg;
        } else if (typeof arg === "object" && arg !== null) {
            ({ content = "", embeds = [], components = [] } = arg);
        } else {
            throw new Error(
                "Invalid argument type. Expected a string or an object.",
            );
        }

        const response = await this.discordLib.request(
            this.discordLib.token,
            "POST",
            `/channels/${this.channelId}/messages`,
            {
                content: content,
                embeds: embeds,
                components: components,
                message_reference: { message_id: this.id },
            },
        );

        return new Message(response, this.discordLib);
    }

    createMessageCollector(options = {}) {
        return new MessageCollector(this.discordLib, this, options);
    }

    createMessageComponentCollector(options = {}) {
        return new MessageComponentCollector(this.discordLib, this, options);
    }
}

class User {
    constructor(data) {
        this.username = data.username || "";
        this.discriminator = data.discriminator || "";
        this.id = data.id || "";
        this.avatar = data.avatar || "";
    }
}

class MessageCollector extends EventEmitter {
    constructor(discordLib, channel, options = { time, filter }) {
        super();
        this.discordLib = discordLib;
        this.channel = channel;
        this.options = options;
        this.collected = new Map();
        this.ended = false;

        if (this.options.time) {
            this.timeout = setTimeout(
                () => this.stop("time"),
                this.options.time,
            );
        }

        this.listener = (message) => this.handleMessage(message);
        discordLib.on("messageCreate", this.listener);
    }

    handleMessage(message) {
        if (this.filter(message)) {
            this.collected.set(message.id, message);
            this.emit("collect", message);

            if (this.options.max && this.collected.size >= this.options.max) {
                this.stop("limit");
            }
        }
    }

    filter(message) {
        if (message.channelId !== this.channel.id) return false;
        if (this.options.filter && !this.options.filter(message)) return false;
        return true;
    }

    stop(reason) {
        if (this.ended) return;
        this.ended = true;
        if (this.timeout) clearTimeout(this.timeout);
        this.discordLib.off("messageCreate", this.listener);
        this.emit("end", this.collected, reason);
    }
}

class MessageComponentCollector extends EventEmitter {
    constructor(discordLib, message, options = {}) {
        super();
        this.discordLib = discordLib;
        this.message = message;
        this.options = options;
        this.collected = new Map();
        this.ended = false;

        if (this.options.time) {
            this.timeout = setTimeout(
                () => this.stop("time"),
                this.options.time,
            );
        }

        this.listener = (interaction) => this.handleInteraction(interaction);
        discordLib.on("interactionCreate", this.listener);
    }

    handleInteraction(interaction) {
        if (this.filter(interaction)) {
            this.collected.set(interaction.id, interaction);
            this.emit("collect", interaction);

            if (this.options.max && this.collected.size >= this.options.max) {
                this.stop("limit");
            }
        }
    }

    filter(interaction) {
        if (interaction.message.id !== this.message.id) return false;
        if (this.options.filter && !this.options.filter(interaction))
            return false;
        return true;
    }

    stop(reason) {
        if (this.ended) return;
        this.ended = true;
        if (this.timeout) clearTimeout(this.timeout);
        this.discordLib.off("interactionCreate", this.listener);
        this.emit("end", this.collected, reason);
    }
}

module.exports = { Message, User, MessageCollector, MessageComponentCollector };
