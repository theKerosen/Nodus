// commands/status.js
const { createServicesStatusImage } = require("../utils/imageGenerator");

function parseCsStatus(rawDataString) {
    try {
        if (!rawDataString) return null;
        if (typeof rawDataString !== "string") {
            console.warn(
                "[ParseCSStatus] Received non-string data:",
                typeof rawDataString,
            );

            if (typeof rawDataString === "object")
                rawDataString = JSON.stringify(rawDataString);
            else return null;
        }
        return JSON.parse(rawDataString);
    } catch (e) {
        console.error("[ParseCSStatus] Failed to parse CS status JSON:", e);
        return null;
    }
}

module.exports = {
    name: "status",
    aliases: ["s"],
    description: "Status do Counter-Strike 2",

    subcommands: {
        services: {
            aliases: ["s", "svc"],
            devOnly: false,
            description: "Status dos serviços principais do CS.",
            execute: async (client, message, args) => {
                const rawData = client.statusDataMap.get("counterStrike");
                const statusData = parseCsStatus(rawData);

                if (rawData === undefined || rawData === null) {
                    return message
                        .reply(
                            "Ainda não foi possível obter dados da API de status. Verificando novamente em breve.",
                        )
                        .catch(console.error);
                }

                try {
                    await message.channel.sendTyping().catch(console.warn);
                    const imageBuffer =
                        await createServicesStatusImage(statusData);
                    if (!imageBuffer || imageBuffer.length === 0) {
                        return message
                            .reply({
                                content: "Falha ao gerar imagem de status.",
                            })
                            .catch(console.error);
                    }
                    const imageName = `cs_services_status_${Date.now()}.png`;

                    await message.reply({
                        content: `*${new Date().toLocaleString("pt-BR")}*`,
                        files: [{ attachment: imageBuffer, name: imageName }],
                    });
                } catch (error) {
                    console.error(
                        "Error processing or generating services status image:",
                        error,
                    );
                    await message
                        .reply({
                            content:
                                "Ocorreu um erro ao gerar a imagem de status.",
                        })
                        .catch(console.error);
                }
            },
        },
        /*
        datacenters: {
            aliases: ["d", "dc"],
            devOnly: false,
            description: "Status de todos os datacenters",
            execute: async (client, message, args) => {
                const rawData = client.statusDataMap.get("counterStrike");
                const statusData = parseCsStatus(rawData);

                if (!statusData?.data?.status?.datacenters) {
                    return message
                        .reply(
                            "Não foi possível obter informações dos datacenters. (Dados indisponíveis ou API instável!)",
                        )
                        .catch(console.error);
                }

                try {
                    const datacenters = Object.entries(
                        statusData.data.status.datacenters,
                    )
                        .filter(
                            ([_, value]) =>
                                value && value.capacity && value.load,
                        )
                        .sort(([keyA], [keyB]) =>
                            keyA === "Brazil" ? -1 : keyB === "Brazil" ? 1 : 0,
                        );

                    if (datacenters.length === 0) {
                        return message
                            .reply({ content: "Nenhum datacenter disponível." })
                            .catch(console.error);
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
                        loadStateMapping[state?.toLowerCase()] ??
                        loadStateMapping.idle;
                    const getCapacityStatus = (state) =>
                        capacityStateMapping[state?.toLowerCase()] ??
                        capacityStateMapping.idle;

                    const itemsPerPage = 3;
                    const totalPages = Math.ceil(
                        datacenters.length / itemsPerPage,
                    );
                    let currentPageIndex = 0;

                    const generatePageEmbed = (pageIndex) => {
                        const start = pageIndex * itemsPerPage;
                        const chunk = datacenters.slice(
                            start,
                            start + itemsPerPage,
                        );
                        const embed = new EmbedBuilder()
                            .setTitle(
                                `🌐 Datacenters - Página ${pageIndex + 1}/${totalPages}`,
                            )
                            .setThumbnail(
                                "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1729703045",
                            )
                            .setColor(0x2febbf)
                            .setDescription("📊 Status atual dos datacenters")
                            .setFooter({
                                text: "Componentes desativados após 1 minuto.",
                            });
                        for (const [key, value] of chunk) {
                            embed.addFields([
                                { name: `📍 ${key}`, value: " ", inline: true },
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
                        return embed.toJSON();
                    };

                    const generateActionRow = (pageIndex) => {
                        const backward = new ButtonBuilder()
                            .setCustomId("dc_backward")
                            .setEmoji("⬅️")
                            .setStyle(ButtonStyle.PRIMARY)
                            .setDisabled(pageIndex === 0);
                        const forward = new ButtonBuilder()
                            .setCustomId("dc_forward")
                            .setEmoji("➡️")
                            .setStyle(ButtonStyle.PRIMARY)
                            .setDisabled(pageIndex >= totalPages - 1);
                        return new ActionRowBuilder()
                            .addComponents(backward, forward)
                            .toJSON();
                    };

                    const replyMessage = await message.reply({
                        embeds: [generatePageEmbed(currentPageIndex)],
                        components:
                            totalPages > 1
                                ? [generateActionRow(currentPageIndex)]
                                : [],
                    });
                    if (!replyMessage || totalPages <= 1) return;

                    const filter = (interaction) =>
                        interaction.user.id === message.author.id &&
                        interaction.isButton();
                    const collector = new InteractionCollector(
                        client,
                        { filter, time: 60000 },
                        replyMessage,
                    );

                    collector.on("collect", async (interaction) => {
                        try {
                            await interaction.deferUpdate();
                            if (
                                interaction.customId === "dc_backward" &&
                                currentPageIndex > 0
                            ) {
                                currentPageIndex--;
                            } else if (
                                interaction.customId === "dc_forward" &&
                                currentPageIndex < totalPages - 1
                            ) {
                                currentPageIndex++;
                            } else {
                                return;
                            }

                            await replyMessage.edit({
                                embeds: [generatePageEmbed(currentPageIndex)],
                                components: [
                                    generateActionRow(currentPageIndex),
                                ],
                            });
                        } catch (error) {
                            console.error(
                                "Error updating pagination interaction:",
                                error,
                            );
                        }
                    });

                    collector.on("end", async (collected, reason) => {
                        console.log(
                            `Datacenter collector ended for message ${replyMessage?.id}. Reason: ${reason}`,
                        );
                        if (!replyMessage || replyMessage.deleted) return;
                        try {
                            const finalEmbed =
                                generatePageEmbed(currentPageIndex);
                            await replyMessage.edit({
                                embeds: [finalEmbed],
                                components: [],
                            });
                        } catch (error) {
                            console.warn(
                                "Could not edit components off message after collector end:",
                                error.message,
                            );
                        }
                    });
                } catch (error) {
                    console.error(
                        "Error processing datacenters status:",
                        error,
                    );
                    await message
                        .reply({
                            content: "Algo deu errado ao buscar datacenters.",
                        })
                        .catch(console.error);
                }
            },
        },
        */
    },
};
