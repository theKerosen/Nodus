const WebSocket = require("ws");

function connectToGateway(token, gatewayUrl, events) {
    const gatewayWs = new WebSocket(`${gatewayUrl}?v=10&encoding=json`);

    gatewayWs.on("open", () => {
        console.log("Connected to Discord Gateway");
    });

    gatewayWs.on("message", (data) => {
        const message = JSON.parse(data);
        if (message.op === 10) {
            events.startHeartbeat(gatewayWs, message.d.heartbeat_interval);
            events.sendIdentifyPayload(gatewayWs, token);
        } else if (message.t === "MESSAGE_CREATE") {
            events.emit("messageCreate", message.d);
        }
    });

    gatewayWs.on("close", () => {
        console.log("Disconnected from Discord Gateway");
        clearInterval(events.heartbeatInterval);

        setTimeout(() => {
            events.connectToGateway(token, gatewayUrl, events);
        }, 5000);
    });

    gatewayWs.on("error", (err) => {
        console.error("Discord Gateway error:", err.message);
    });

    return gatewayWs;
}

module.exports = { connectToGateway };
