const { EmbedBuilder } = require("../components/builders/embedBuilder");
const { ButtonBuilder } = require("../components/builders/buttonBuilder");
const { ActionRowBuilder } = require("../components/builders/actionRow");
const { ButtonStyle } = require("../components/builders/buttonStyle");

module.exports = {
    name: "status",
    aliases: ["s"],
    cooldown: 2000,
    description: "Status do Counter-Strike 2",
    init: async (context, bot) => {
        context.sharedData = bot.statusDataMap.get("counterStrike");
    },
    subcommands: {
        services: {
            aliases: ["s", "svc"],
            cooldown: 3000,
            devOnly: false,
            description: "Status de todos os serviços",
            execute: async (bot, context, args) => {
                if (!context.sharedData) {
                    return await context.reply(
                        "Não foi possível obter informações dos servidores. (Dados ainda não disponíveis ou API instável!)",
                    );
                }

                const serviceStateMapping = {
                    normal: "Normal",
                    delayed: "Atrasado ⚠️",
                    surge: "Sobrecarga ⚠️",
                    offline: "Offline ⚠️",
                };

                try {
                    const req = JSON.parse(context.sharedData);
                    const { services, matchmaker } = req.data.status;

                    const embed = new EmbedBuilder()
                        .setTitle("🌐 Serviços")
                        .setThumbnail(
                            "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1729703045",
                        )
                        .setColor(0x2febbf)
                        .setDescription("📊 Status atual dos serviços")
                        .addFields([
                            {
                                name: "🔑 Sessões de Logon",
                                value: `>${serviceStateMapping[services.SessionsLogon.toLowerCase()] || serviceStateMapping.offline}`,
                                inline: false,
                            },
                            {
                                name: "👥 Comunidade Steam",
                                value: `>${serviceStateMapping[services.SteamCommunity.toLowerCase()] || serviceStateMapping.offline}`,
                                inline: false,
                            },
                            {
                                name: "🎮 Criador de Partidas",
                                value: `>${serviceStateMapping[matchmaker.scheduler.toLowerCase()] || serviceStateMapping.offline}`,
                                inline: false,
                            },
                        ])
                        .build();

                    await context.reply({ embeds: [embed] });
                } catch (error) {
                    console.error("Error fetching services:", error);
                    await context.reply({
                        content: "A API não está acessível no momento.",
                    });
                }
            },
        },
        datacenters: {
            aliases: ["d", "dc"],
            devOnly: false,
            cooldown: 5000,
            description: "Status de todos os datacenters",
            execute: async (bot, context, args) => {
                if (!context.sharedData) {
                    return await context.reply(
                        "Não foi possível obter informações dos servidores. (Dados ainda não disponíveis ou API instável!)",
                    );
                }

                try {
                    const req = JSON.parse(context.sharedData);
                    const datacenters = Object.entries(
                        req.data.status.datacenters,
                    )
                        .filter(([_, value]) => value.capacity && value.load)
                        .sort(([keyA], [keyB]) =>
                            keyA === "Brazil" ? -1 : keyB === "Brazil" ? 1 : 0,
                        );

                    if (datacenters.length === 0) {
                        return await context.reply({
                            content: "Nenhum datacenter disponível.",
                        });
                    }

                    const loadStateMapping = {
                        full: "Máxima ⚠️",
                        high: "Alta ⚠️",
                        medium: "Média",
                        low: "Baixa",
                        idle: "Inativa",
                    };

                    const capacityStateMapping = {
                        full: "Máxima",
                        high: "Alta ⚠️",
                        medium: "Média",
                        idle: "Ociosa",
                    };

                    const getLoadStatus = (state) =>
                        loadStateMapping[state.toLowerCase()] ||
                        loadStateMapping.idle;
                    const getCapacityStatus = (state) =>
                        capacityStateMapping[state.toLowerCase()] ||
                        capacityStateMapping.idle;

                    const embed_pag = new EmbedBuilder();
                    embed_pag.setPagination(datacenters, 3, (chunk, index) => {
                        const embed = new EmbedBuilder()
                            .setTitle(`🌐 Datacenters - Página ${index + 1}`)
                            .setThumbnail(
                                "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1729703045",
                            )
                            .setColor(0x2febbf)
                            .setDescription("📊 Status atual dos datacenters")
                            .setFooter(
                                "Essa mensagem se auto-destruirá em 1 minuto.",
                            );

                        for (const [key, value] of chunk) {
                            embed.addFields([
                                { name: `📍 ${key}`, value: "‎", inline: true },
                                {
                                    name: "🖥️ Capacidade",
                                    value: getCapacityStatus(value.capacity),
                                    inline: true,
                                },
                                {
                                    name: "⚖️ Carga",
                                    value: getLoadStatus(value.load),
                                    inline: true,
                                },
                            ]);
                        }

                        return embed.build();
                    });

                    const pages = { [context.author.id]: 0 };

                    const createActionRow = (pages, userId, embedBuilder) => {
                        const backward = new ButtonBuilder()
                            .setCustomId("s_backward")
                            .setEmoji("⬅️")
                            .setLabel("\u200b")
                            .setStyle(ButtonStyle.PRIMARY)
                            .setDisabled(pages[userId] === 0)
                            .build();

                        const forward = new ButtonBuilder()
                            .setCustomId("s_forward")
                            .setEmoji("➡️")
                            .setLabel("\u200b")
                            .setStyle(ButtonStyle.PRIMARY)
                            .setDisabled(
                                pages[userId] ===
                                    embedBuilder.getAllPages().length - 1,
                            )
                            .build();

                        return new ActionRowBuilder()
                            .addComponent(backward)
                            .addComponent(forward)
                            .build();
                    };

                    const reply = await context.reply({
                        embeds: [embed_pag.getPage(pages[context.author.id])],
                        components: [
                            createActionRow(
                                pages,
                                context.author.id,
                                embed_pag,
                            ),
                        ],
                    });

                    const filter = (interaction) =>
                        interaction.user.id === context.author.id;
                    const collector = reply.createMessageComponentCollector({
                        time: 60000,
                        filter,
                    });

                    collector.on("collect", async (interaction) => {
                        await interaction.defer();
                        if (
                            interaction.data.custom_id === "s_backward" &&
                            pages[context.author.id] > 0
                        ) {
                            pages[context.author.id]--;
                        } else if (
                            interaction.data.custom_id === "s_forward" &&
                            pages[context.author.id] <
                                embed_pag.getAllPages().length - 1
                        ) {
                            pages[context.author.id]++;
                        }

                        await reply.edit({
                            embeds: [
                                embed_pag.getPage(pages[context.author.id]),
                            ],
                            components: [
                                createActionRow(
                                    pages,
                                    context.author.id,
                                    embed_pag,
                                ),
                            ],
                        });
                    });

                    collector.on("end", async () => {
                        await reply.delete();
                        console.log("Collector ended, message deleted.");
                    });
                } catch (error) {
                    console.error("Error fetching datacenters:", error);
                    await context.reply({ content: "Algo deu errado." });
                }
            },
        },
    },
};
