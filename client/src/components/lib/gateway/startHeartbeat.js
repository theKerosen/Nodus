function startHeartbeat(gatewayWs, interval) {
    const heartbeatInterval = setInterval(() => {
        gatewayWs.send(JSON.stringify({ op: 1, d: null }));
    }, interval);

    return heartbeatInterval;
}

module.exports = startHeartbeat;
