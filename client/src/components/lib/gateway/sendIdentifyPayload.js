function sendIdentifyPayload(gatewayWs, token) {
    const payload = {
        op: 2,
        d: {
            token: token,
            intents: 53608447,
            properties: {
                $os: 'linux',
                $browser: 'nodus',
                $device: 'nodus'
            }
        }
    };
    gatewayWs.send(JSON.stringify(payload));
    console.log('Sent IDENTIFY payload');
}

module.exports = sendIdentifyPayload;
