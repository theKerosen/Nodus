const { EmbedBuilder } = require("../components/builders/embedBuilder");

module.exports = (bot) => {
    const lastKnownStatus = {};
    let isFirstCheck = true;

    const notifyChannel = async (channelId, embed) => {
        const channel = bot.channels.get(channelId);
        if (channel) await channel.send({ embeds: [embed] });
        else console.warn(`Channel ${channelId} not found.`);
    };

    const buildEmbed = (title, color, description, fields = []) =>
        new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(description)
            .addFields(fields)
            .build();

    const checkServiceStatus = (req) => {
        const serviceStateMapping = {
            normal: { text: "Normal", isAbnormal: false },
            delayed: { text: "Atrasado ⚠️", isAbnormal: true },
            surge: { text: "Sobrecarga ⚠️", isAbnormal: true },
            offline: { text: "Offline ⚠️", isAbnormal: true },
        };

        const criticalServices = [
            {
                name: "🔑 Sessões de Logon",
                key: "SessionsLogon",
                path: "services",
            },
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

        for (const { name, key, path } of criticalServices) {
            const state = (
                path === "services"
                    ? req.data.status.services
                    : req.data.status.matchmaker
            )[key];
            const status =
                serviceStateMapping[state?.toLowerCase()] ||
                serviceStateMapping.offline;
            const previousStatus = lastKnownStatus[key]?.text;

            if (previousStatus !== status.text) {
                lastKnownStatus[key] = status;
                if (status.isAbnormal) {
                    updates.hasIssues = true;
                    updates.issues.push(`${name}: ${status.text}`);
                } else if (previousStatus) {
                    updates.shouldSendClearMessage = true;
                }
            }
        }

        return updates;
    };

    const fetchCounterStrikeStatus = async () => {
        const luaFile = process.env.CS_API_SCRIPT;
        if (!bot.luaHandler.luaFiles.includes(luaFile)) {
            throw new Error(`Required Lua script not found: ${luaFile}`);
        }

        const taskFilePath =
            typeof bot.luaHandler.getTaskPath === "function"
                ? bot.luaHandler.getTaskPath(luaFile)
                : bot.luaHandler.getTaskPath;

        if (typeof taskFilePath !== "string") {
            throw new Error(`Invalid task file path: ${taskFilePath}`);
        }

        return new Promise((resolve, reject) => {
            bot.tickrateClient.runLuaTask(
                luaFile,
                taskFilePath,
                { url: process.env.CS_API_URL },
                (response) => {
                    if (response.error) reject(new Error(response.error));
                    else resolve(response);
                },
            );
        });
    };

    const updateAndCheckStatus = async () => {
        try {
            const csApiData = await fetchCounterStrikeStatus();
            bot.statusDataMap.clear();
            bot.statusDataMap.set("counterStrike", csApiData);
            const req = JSON.parse(csApiData);
            const { hasIssues, issues, shouldSendClearMessage } =
                checkServiceStatus(req);

            if (hasIssues) {
                const embed = buildEmbed(
                    "🚨 Alerta de Problemas no Counter-Strike 🚨",
                    0xff0000,
                    "Os seguintes serviços estão enfrentando problemas:",
                    issues.map((issue) => ({
                        name: "Serviço",
                        value: issue,
                        inline: false,
                    })),
                );
                await notifyChannel(process.env.SERVER_CHANNEL, embed);
            }

            const allNormal = Object.values(lastKnownStatus).every(
                (status) => !status.isAbnormal,
            );
            if (allNormal && shouldSendClearMessage && !isFirstCheck) {
                const embed = buildEmbed(
                    "✅ Todos os Serviços do Counter-Strike Estão Funcionando ✅",
                    0x00ff00,
                    "Todos os serviços críticos estão funcionando normalmente.",
                );
                await notifyChannel(process.env.SERVER_CHANNEL, embed);
                Object.keys(lastKnownStatus).forEach(
                    (key) => delete lastKnownStatus[key],
                );
            }

            isFirstCheck = false;
        } catch (error) {
            console.error(
                "Error checking Counter-Strike status:",
                error.message,
            );
        }
    };

    bot.on("ready", async () => {
        console.log("I am ready.");
        await bot.gateway(),
            await bot.fetch_guilds(),
            await bot.fetch_channels(),
            await bot.luaHandler.loadLuaFiles(),
            setInterval(updateAndCheckStatus, 12000);
        await updateAndCheckStatus();
    });
};
