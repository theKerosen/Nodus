const net = require("net");
const fs = require("fs");

const MESSAGE_DELIMITER = "\x1e";

class TickrateClient {
    constructor(host, port) {
        this.host = host || "localhost";
        this.port = port || 8080;
        this.socket = null;
        this.pendingCallbacks = new Map();
        this.requestCounter = 0;
        this.connect();
    }

    connect() {
        if (this.socket) return;

        this.socket = new net.Socket();
        let buffer = Buffer.alloc(0);

        this.socket.connect(this.port, this.host, () => {
            console.log("Connected to Tickrate server");
        });

        this.socket.on("data", (data) => {
            buffer = Buffer.concat([buffer, data]);
            let delimiterIndex;
            while (
                (delimiterIndex = buffer.indexOf(MESSAGE_DELIMITER)) !== -1
            ) {
                const messageBuffer = buffer.slice(0, delimiterIndex);
                buffer = buffer.slice(delimiterIndex + 1);
                if (messageBuffer.length > 0) {
                    try {
                        const message = JSON.parse(messageBuffer.toString());
                        this._processMessage(message);
                    } catch (err) {
                        console.error(
                            "Failed to parse message:",
                            messageBuffer.toString(),
                            err,
                        );
                        if (this.pendingCallbacks.size > 0) {
                            const [requestId, callback] = this.pendingCallbacks
                                .entries()
                                .next().value;
                            callback({ error: messageBuffer.toString() });
                            this.pendingCallbacks.delete(requestId);
                        }
                    }
                }
            }
        });

        this.socket.on("close", () => {
            console.log("Disconnected from server, retrying connection...");
            setTimeout(() => this.connect(), 5000);
            this.socket = null;
            this.pendingCallbacks.clear();
        });

        this.socket.on("error", (err) => {
            console.error("Connection error:", err.message);
            this.socket = null;
            this.pendingCallbacks.clear();
        });

        this.socket.setTimeout(12000, () => {
            console.log("Connection timeout reached");
            if (this.socket) {
                this.socket.destroy();
                this.socket = null;
            }
        });
    }

    _processMessage(message) {
        if (message.type === "heartbeat") {
            const response = JSON.stringify({
                type: "heartbeat_response",
                id: message.id,
            });
            this.socket.write(response + "\x1e");
            return;
        }
        if (message.id && this.pendingCallbacks.has(message.id)) {
            const callback = this.pendingCallbacks.get(message.id);
            if (message.type === "task_result") {
                callback(message.data);
            } else if (message.type === "error") {
                callback({ error: message.data.message });
            } else {
                callback({ error: "Unknown response type", raw: message });
            }
            this.pendingCallbacks.delete(message.id);
        }
    }

    runLuaTask(luaFile, taskFilePath, customArgs, callback) {
        if (!this.socket || this.socket.destroyed) {
            callback({ error: "Socket is not connected" });
            return;
        }

        let taskBody;
        try {
            taskBody = fs.readFileSync(taskFilePath, "utf8");
        } catch (err) {
            callback({ error: err.message });
            return;
        }

        const requestId = `client-${this.requestCounter++}`;
        const message = {
            id: requestId,
            type: "command",
            data: {
                type: "command",
                data: {
                    name: "add_task",
                    args: {
                        task_name: luaFile,
                        task_body: taskBody,
                        custom_args: customArgs,
                    },
                },
            },
        };
        this.pendingCallbacks.set(requestId, callback);
        const messageStr = JSON.stringify(message) + "\x1e";
        this.socket.write(messageStr);
    }
}

module.exports = TickrateClient;
