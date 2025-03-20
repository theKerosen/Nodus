/**
 * A utility class for building Discord embeds.
 */
class EmbedBuilder {
    /**
     * Creates a new instance of EmbedBuilder.
     */
    constructor() {
        /**
         * The internal representation of the embed object.
         * @type {Object}
         */
        this.embed = {
            title: "",
            description: "",
            color: 0x00ff00,
            fields: [],
            footer: {},
            image: {},
            thumbnail: {},
        };
        /**
         * An array to store paginated embeds.
         * @type {Array<Object>}
         */
        this.pages = [];
    }

    /**
     * Sets the title of the embed.
     * @param {string} title - The title of the embed.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setTitle(title) {
        this.embed.title = title;
        return this;
    }

    /**
     * Sets the description of the embed.
     * @param {string} description - The description of the embed.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setDescription(description) {
        this.embed.description = description;
        return this;
    }

    /**
     * Sets the color of the embed.
     * @param {number} color - The color of the embed as a hexadecimal number.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setColor(color) {
        this.embed.color = color;
        return this;
    }

    /**
     * Adds a single field to the embed.
     * @param {string} name - The name of the field.
     * @param {string} value - The value of the field.
     * @param {boolean} [inline=false] - Whether the field should be displayed inline.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    addField(name, value, inline = false) {
        this.embed.fields.push({
            name: name,
            value: value,
            inline: inline,
        });
        return this;
    }

    /**
     * Adds multiple fields to the embed.
     * @param {Array<Object>} fields - An array of field objects, each containing `name`, `value`, and optionally `inline`.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    addFields(fields) {
        fields.forEach((field) => {
            this.embed.fields.push({
                name: field.name,
                value: field.value,
                inline: field.inline || false,
            });
        });
        return this;
    }

    /**
     * Sets the footer of the embed.
     * @param {string} text - The text of the footer.
     * @param {string} [icon_url] - The URL of the footer icon.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setFooter(text, icon_url) {
        this.embed.footer = {
            text: text,
            icon_url: icon_url,
        };
        return this;
    }

    /**
     * Sets the image of the embed.
     * @param {string} url - The URL of the image.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setImage(url) {
        this.embed.image = {
            url: url,
        };
        return this;
    }

    /**
     * Sets the thumbnail of the embed.
     * @param {string} url - The URL of the thumbnail.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setThumbnail(url) {
        this.embed.thumbnail = {
            url: url,
        };
        return this;
    }

    /**
     * Sets up pagination for the embed.
     * @param {Array} data - The data to paginate (e.g., datacenters).
     * @param {number} itemsPerPage - The number of items to display per page.
     * @param {Function} pageGenerator - A function that generates an embed for a chunk of data.
     * @returns {EmbedBuilder} The current instance of EmbedBuilder for chaining.
     */
    setPagination(data, itemsPerPage, pageGenerator) {
        const chunks = this.chunkArray(data, itemsPerPage);
        this.pages = chunks.map((chunk, index) => pageGenerator(chunk, index));
        return this;
    }

    /**
     * Splits an array into chunks of size `n`.
     * @param {Array} array - The array to split.
     * @param {number} n - The size of each chunk.
     * @returns {Array} An array of chunks.
     */
    chunkArray(array, n) {
        const result = [];
        for (let i = 0; i < array.length; i += n) {
            result.push(array.slice(i, i + n));
        }
        return result;
    }

    /**
     * Retrieves the embed for a specific page.
     * @param {number} pageIndex - The index of the page to retrieve.
     * @returns {Object} The embed object for the specified page.
     * @throws {Error} Throws an error if the page index is invalid.
     */
    getPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= this.pages.length) {
            throw new Error("Invalid page index.");
        }
        return this.pages[pageIndex];
    }

    /**
     * Returns all paginated embeds.
     * @returns {Array<Object>} An array of embed objects.
     */
    getAllPages() {
        return this.pages;
    }

    /**
     * Builds the final embed object.
     * @returns {Object} The constructed embed object.
     */
    build() {
        return this.embed;
    }
}

module.exports = { EmbedBuilder };
