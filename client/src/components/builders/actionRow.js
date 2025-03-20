class ActionRowBuilder {
    constructor() {
        this.type = 1;
        this.components = [];
    }

    addComponent(component) {
        this.components.push(component);
        return this;
    }
    build() {
        return {
            type: this.type,
            components: this.components
        }
    }
}

module.exports = { ActionRowBuilder }