const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("nyowzers-lib");

/**
 * Initializes and returns the state object for status checking.
 */
function initializeStatusState() {
    return {
        lastKnownStatus: {},
        isFirstCheck: true,
    };
}

const notifyChannel = async (client, channelId, embedJson) => {
    if (!channelId) {
        console.warn("[CS Status Notify] No SERVER_CHANNEL defined in .env.");
        return;
    }
    try {
        const channel = await client.channels
            .fetch(channelId)
            .catch(() => null);
        if (channel?.send) {
            await channel.send({ embeds: [embedJson] });
            console.log(
                `[CS Status Notify] Sent status update to channel ${channelId}`,
            );
        } else {
            console.warn(
                `[CS Status Notify] Channel ${channelId} not found or cannot send messages.`,
            );
        }
    } catch (error) {
        console.error(
            `[CS Status Notify] Failed to send notification to channel ${channelId}:`,
            error,
        );
    }
};

const buildEmbedJson = (title, color, description, fields = []) => {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description)
        .setTimestamp();
    if (fields && fields.length > 0) {
        embed.addFields(fields);
    }
    return embed.toJSON();
};

/**
 * Compares current status with last known status.
 * MUTATES statusState.lastKnownStatus.
 * @param {object} parsedData - Parsed API response.
 * @param {object} statusState - The state object { lastKnownStatus, isFirstCheck }.
 * @returns {object} - { hasIssues: boolean, issues: string[], shouldSendClearMessage: boolean }
 */
const checkServiceStatus = (parsedData, statusState) => {
    const { lastKnownStatus } = statusState;

    if (
        !parsedData?.data?.status?.services ||
        !parsedData?.data?.status?.matchmaker
    ) {
        console.warn("[CS Status Check] Invalid status data structure.");
        return { hasIssues: false, issues: [], shouldSendClearMessage: false };
    }
    const { services, matchmaker } = parsedData.data.status;

    const serviceStateMapping = {
        normal: { text: "Normal", isAbnormal: false },
        delayed: { text: "Atrasado ⚠️", isAbnormal: true },
        surge: { text: "Sobrecarga ⚠️", isAbnormal: true },
        offline: { text: "Offline ⚠️", isAbnormal: true },
    };
    const criticalServices = [
        { name: "🔑 Sessões de Logon", key: "SessionsLogon", path: "services" },
        {
            name: "🎮 Criador de Partidas",
            key: "scheduler",
            path: "matchmaker",
        },
    ];

    const updates = {
        hasIssues: false,
        issues: [],
        shouldSendClearMessage: false,
    };
    let anyStatusChanged = false;
    let justRecovered = false;

    for (const { name, key, path } of criticalServices) {
        const stateSource = path === "services" ? services : matchmaker;
        const state = stateSource ? stateSource[key] : undefined;
        const currentStatus =
            serviceStateMapping[state?.toLowerCase()] ??
            serviceStateMapping.offline;
        const previousStatus = lastKnownStatus[key];

        if (previousStatus?.text !== currentStatus.text) {
            console.log(
                `[CS Status Check] Change detected for ${name}: ${previousStatus?.text ?? "None"} -> ${currentStatus.text}`,
            );
            anyStatusChanged = true;
            const wasPreviouslyAbnormal = previousStatus?.isAbnormal ?? false;

            lastKnownStatus[key] = currentStatus;

            if (currentStatus.isAbnormal) {
                updates.hasIssues = true;
                updates.issues.push(`${name}: ${currentStatus.text}`);
            } else if (wasPreviouslyAbnormal) {
                justRecovered = true;
            }
        } else if (currentStatus.isAbnormal) {
            updates.hasIssues = true;

            if (!updates.issues.some((issue) => issue.startsWith(name))) {
                updates.issues.push(`${name}: ${currentStatus.text}`);
            }
        }
    }

    const allCurrentlyNormal = Object.values(lastKnownStatus).every(
        (status) => !status.isAbnormal,
    );

    if (allCurrentlyNormal && justRecovered) {
        updates.shouldSendClearMessage = true;
    }

    return updates;
};

/**
 * Fetches CS status, processes it, and sends notifications.
 * @param {Client} client
 * @param {TickrateClient} tickrateClient
 * @param {LuaHandler} luaHandler
 * @param {object} statusState - MUTATED: { lastKnownStatus, isFirstCheck }
 */
async function updateAndCheckStatus(
    client,
    tickrateClient,
    luaHandler,
    statusState,
) {
    try {
        const luaFile = process.env.CS_API_SCRIPT || "ares.lua";
        const taskFilePath = luaHandler.getTaskPath(luaFile);
        const customArgs = { url: process.env.CS_API_URL };
        const notificationChannelId = process.env.SERVER_CHANNEL;

        if (!process.env.CS_API_URL || !notificationChannelId) {
            console.warn(
                "[CS Status Update] CS_API_URL or SERVER_CHANNEL not set. Skipping check.",
            );
            return;
        }
        if (!fs.existsSync(taskFilePath)) {
            console.error(
                `[CS Status Update] Lua script not found: ${taskFilePath}. Skipping check.`,
            );
            client.statusDataMap.set("counterStrike", null);
            return;
        }

        const response = await new Promise((resolve, reject) => {
            tickrateClient.runLuaTask(
                luaFile,
                taskFilePath,
                customArgs,
                (res) => {
                    if (res.error) {
                        reject(new Error(res.error));
                    } else {
                        resolve(res);
                    }
                },
            );
        }).catch((err) => {
            console.error(
                "[CS Status Update] Error fetching status via Tickrate Promise:",
                err.message,
            );
            client.statusDataMap.set("counterStrike", null);
            return null;
        });

        if (response === null) return;

        client.statusDataMap.set("counterStrike", response);
        console.log("[CS Status Update] Successfully fetched CS Status data.");

        let parsedData;
        try {
            parsedData = JSON.parse(response);
        } catch (e) {
            console.error(
                "[CS Status Update] Failed to parse JSON response:",
                e,
            );
            return;
        }

        const { hasIssues, issues, shouldSendClearMessage } =
            checkServiceStatus(parsedData, statusState);

        if (hasIssues) {
            console.log(
                "[CS Status Update] Issues detected, preparing notification.",
            );
            const embedJson = buildEmbedJson(
                "🚨 Alerta de Problemas no Counter-Strike 🚨",
                0xff0000,
                "Os seguintes serviços críticos estão enfrentando problemas:",
                issues.map((issue) => ({
                    name: "Serviço",
                    value: issue,
                    inline: false,
                })),
            );
            await notifyChannel(client, notificationChannelId, embedJson);
        }

        const allKnownAreNormal =
            Object.keys(statusState.lastKnownStatus).length > 0 &&
            Object.values(statusState.lastKnownStatus).every(
                (status) => !status.isAbnormal,
            );

        if (
            allKnownAreNormal &&
            shouldSendClearMessage &&
            !statusState.isFirstCheck
        ) {
            console.log(
                "[CS Status Update] All critical services back to normal, sending notification.",
            );
            const embedJson = buildEmbedJson(
                "✅ Serviços do Counter-Strike Normalizados ✅",
                0x00ff00,
                "Todos os serviços críticos monitorados voltaram a funcionar normally.",
                [],
            );
            await notifyChannel(client, notificationChannelId, embedJson);
        } else if (shouldSendClearMessage && statusState.isFirstCheck) {
            console.log(
                "[CS Status Update] Services initially normal or recovered before first notification cycle.",
            );
        } else if (
            !allKnownAreNormal &&
            !hasIssues &&
            !statusState.isFirstCheck
        ) {
            console.log(
                "[CS Status Update] Critical services checked are normal, but overall state might include unknowns.",
            );
        }

        statusState.isFirstCheck = false;
    } catch (error) {
        console.error(
            "[CS Status Update] Uncaught exception during update/check process:",
            error,
        );
        client.statusDataMap.set("counterStrike", null);
    }
}

module.exports = {
    initializeStatusState,
    updateAndCheckStatus,
};
