const EventEmitter = require("events");
const { Message } = require("../objects/message");
const {
  MessageCollector,
  MessageComponentCollector,
} = require("../objects/message");

class Channel extends EventEmitter {
  constructor(data, discordLib) {
    super();
    this.discordLib = discordLib;
    this.id = data.id;
    this.name = data.name || "";
    this.type = data.type || 0;
    this.topic = data.topic || "";
    this.nsfw = data.nsfw || false;
    this.lastMessageId = data.last_message_id || "";
    this.rateLimitPerUser = data.rate_limit_per_user || 0;
    this.position = data.position || 0;
    this.parentId = data.parent_id || "";
    this.guildId = data.guild_id || "";
  }

  async send(arg) {
    let content,
      embeds = [],
      components = [];

    if (typeof arg === "string") {
      content = arg;
    } else if (typeof arg === "object" && arg !== null) {
      ({ content = "", embeds = [], components = [] } = arg);
    } else {
      throw new Error("Invalid argument type. Expected a string or an object.");
    }

    const response = await this.discordLib.request(
      this.discordLib.token,
      "POST",
      `/channels/${this.id}/messages`,
      { content, embeds, components },
    );

    return new Message(response, this.discordLib);
  }

  async fetch(channel_id) {
    const response = await this.request(
      this.token,
      "GET",
      `/channels/${channel_id}`,
    );
    const channel = new Channel(response, this);
    this.discordLib.channels.set(channel_id, channel);
    return channel;
  }

  createMessageCollector(options = {}) {
    return new MessageCollector(this.discordLib, this, options);
  }

  createMessageComponentCollector(options = {}) {
    return new MessageComponentCollector(this.discordLib, this, options);
  }
}

module.exports = { Channel };
