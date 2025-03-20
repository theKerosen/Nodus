class ButtonBuilder {
    constructor() {
        this.type = 2;
        this.style = 1;
        this.custom_id = '';
        this.label = '';
        this.emoji = {};
        this.disabled = false;
    }

    setType(type) {
        this.type = type;
        return this;
    }

    setStyle(style) {
        this.style = style;
        return this;
    }

    setCustomId(custom_id) {
        this.custom_id = custom_id;
        return this;
    }

    setLabel(label) {
        this.label = label;
        return this;
    }

    setEmoji(emoji, id = null, animated = false) {
        this.emoji = {
            name: String(emoji),
            id: id,
            animated: animated
        }
        return this;
    }

    setDisabled(disabled) {
        this.disabled = disabled;
        return this;
    }

    build() {
        return {
            type: this.type,
            style: this.style,
            custom_id: this.custom_id,
            label: this.label,
            emoji: this.emoji,
            disabled: this.disabled
        };
    }
}

module.exports = { ButtonBuilder }