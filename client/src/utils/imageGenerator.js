const { createCanvas, registerFont, loadImage } = require("canvas");
const path = require("path");
const util = require("util");

let titleFont = "bold 18px Inter, sans-serif";
let serviceFont = "16px Inter, sans-serif";
let statusFont = "16px Inter, sans-serif";
let apiStatusFont = "bold 16px Inter, sans-serif";

const assetsPath = path.join(__dirname, "..", "..", "assets");

try {
    const fontPath = path.join(assetsPath, "fonts", "Inter-Regular.ttf");
    const fontPathBold = path.join(assetsPath, "fonts", "Inter-Bold.ttf");
    registerFont(fontPath, { family: "Inter", weight: "normal" });
    registerFont(fontPathBold, { family: "Inter", weight: "bold" });

    titleFont = "bold 20px Inter, sans-serif";
    serviceFont = "16px Inter, sans-serif";
    statusFont = "16px Inter, sans-serif";
    useInterFont = true;
} catch (fontError) {
    console.warn(
        `[ImageGen WARN] Could not register Inter font: ${fontError.message}. Using system default sans-serif.`,
    );

    titleFont = "bold 20px sans-serif";
    serviceFont = "16px sans-serif";
    statusFont = "16px sans-serif";
}

let cs2Icon = null;
async function loadCS2Icon() {
    if (cs2Icon) return cs2Icon;
    try {
        const iconPath = path.join(assetsPath, "icons", "cs2_icon.png");
        cs2Icon = await loadImage(iconPath);
        return cs2Icon;
    } catch (iconError) {
        console.warn(
            `[ImageGen WARN] Could not load CS2 icon: ${iconError.message}`,
        );
        return null;
    }
}

function getServiceStatusInfo(statusKey) {
    const lowerKey = statusKey?.toLowerCase();
    let text = "Unknown";
    let color = "#949494";

    switch (lowerKey) {
        case "normal":
            text = "Normal";
            color = "#43b581";
            break;
        case "delayed":
            text = "Lentidão";
            color = "#faa61a";
            break;
        case "surge":
            text = "sobretensão";
            color = "#f04747";
            break;
        case "offline":
            text = "Offline";
            color = "#f04747";
            break;
    }
    return { text, color };
}

async function createServicesStatusImage(statusData) {
    const isApiOk =
        statusData?.data?.status?.services &&
        statusData?.data?.status?.matchmaker;
    const apiStatusText = isApiOk ? "Online" : "Indisponível";
    const apiStatusColor = isApiOk ? "#43b581" : "#f04747";

    const servicesData = isApiOk ? statusData.data.status.services : {};
    const matchmakerData = isApiOk ? statusData.data.status.matchmaker : {};

    const width = 400;
    const titleHeight = 25;
    const apiStatusLineHeight = 25;
    const itemHeight = 32;
    const itemPadding = 6;
    const topPadding = 20;
    const bottomPadding = 20;
    const items = [
        { name: "Sessions Logon", key: "SessionsLogon", source: servicesData },
        {
            name: "Steam Community",
            key: "SteamCommunity",
            source: servicesData,
        },
        { name: "Matchmaking", key: "scheduler", source: matchmakerData },
    ];
    const totalItemHeight =
        items.length * (itemHeight + itemPadding) - itemPadding;

    const height =
        topPadding +
        titleHeight +
        10 +
        apiStatusLineHeight +
        10 +
        totalItemHeight +
        bottomPadding;

    const loadedIcon = await loadCS2Icon();
    const iconSize = 24;
    const iconPadding = 8;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const titleY = topPadding;
    const iconX = width - topPadding - iconSize;
    const apiStatusY = titleY + titleHeight + 10;
    const firstItemBoxY = apiStatusY + apiStatusLineHeight + 10;
    const contentWidth = width - topPadding * 2;
    const borderRadius = 4;
    const indicatorRadius = 6;
    const indicatorX = topPadding + 10 + indicatorRadius;
    const serviceNameX = indicatorX + indicatorRadius + 12;
    const statusTextX = width - topPadding - 10;

    try {
        ctx.fillStyle = "#23272A";
        ctx.fillRect(0, 0, width, height);

        const titleText = "Counter-Strike 2";
        ctx.fillStyle = "#ffffff";
        ctx.font = titleFont;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(titleText, topPadding, titleY + titleHeight / 2);

        if (loadedIcon) {
            const iconY = titleY + titleHeight / 2 - iconSize / 2;
            ctx.drawImage(loadedIcon, iconX, iconY, iconSize, iconSize);
        }

        ctx.fillStyle = "#aaaaaa";
        ctx.font = serviceFont;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
            "Status da API:",
            topPadding,
            apiStatusY + apiStatusLineHeight / 2,
        );

        ctx.fillStyle = apiStatusColor;
        ctx.font = apiStatusFont;
        ctx.textAlign = "right";
        ctx.fillText(
            apiStatusText,
            statusTextX,
            apiStatusY + apiStatusLineHeight / 2,
        );

        let currentBoxY = firstItemBoxY;
        ctx.textBaseline = "middle";

        for (const item of items) {
            const statusInfo = isApiOk
                ? getServiceStatusInfo(item.source?.[item.key])
                : getServiceStatusInfo("unknown");

            ctx.fillStyle = "#2C2F33";
            drawRoundedRect(
                ctx,
                topPadding,
                currentBoxY,
                contentWidth,
                itemHeight,
                borderRadius,
            );

            const itemCenterY = currentBoxY + itemHeight / 2;

            ctx.fillStyle = statusInfo.color;
            ctx.beginPath();
            ctx.arc(indicatorX, itemCenterY, indicatorRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#dcddde";
            ctx.font = serviceFont;
            ctx.textAlign = "left";
            ctx.fillText(item.name, serviceNameX, itemCenterY);

            ctx.fillStyle = statusInfo.color;
            ctx.font = statusFont;
            ctx.textAlign = "right";
            ctx.fillText(statusInfo.text, statusTextX, itemCenterY);

            currentBoxY += itemHeight + itemPadding;
        }

        const buffer = canvas.toBuffer("image/png");
        return buffer;
    } catch (drawError) {
        console.error(
            "[ImageGen ERROR] Error during final canvas drawing v5:",
            drawError,
        );
        throw drawError;
    }
}

function getServiceStatusInfo(statusKey) {
    const lowerKey = statusKey?.toLowerCase();
    let text = "Unknown";
    let color = "#949494";
    switch (lowerKey) {
        case "normal":
            text = "Normal";
            color = "#43b581";
            break;
        case "delayed":
            text = "Delayed";
            color = "#faa61a";
            break;
        case "surge":
            text = "Surge";
            color = "#f04747";
            break;
        case "offline":
            text = "Offline";
            color = "#f04747";
            break;

        case "unknown":
            text = "Unknown";
            color = "#949494";
            break;
    }
    return { text, color };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
}

/**
 * Generates a polished, steamstat.us-style image buffer for the CS Services status.
 */
async function createServicesStatusImage(statusData) {
    const isApiOk =
        statusData?.data?.status?.services &&
        statusData?.data?.status?.matchmaker;
    const apiStatusText = isApiOk ? "Online" : "Indisponível";
    const apiStatusColor = isApiOk ? "#43b581" : "#f04747";

    const servicesData = isApiOk ? statusData.data.status.services : {};
    const matchmakerData = isApiOk ? statusData.data.status.matchmaker : {};

    const width = 400;
    const titleHeight = 25;
    const apiStatusLineHeight = 25;
    const itemHeight = 32;
    const itemPadding = 6;
    const topPadding = 20;
    const bottomPadding = 20;
    const items = [
        { name: "Sessions Logon", key: "SessionsLogon", source: servicesData },
        {
            name: "Steam Community",
            key: "SteamCommunity",
            source: servicesData,
        },
        { name: "Matchmaking", key: "scheduler", source: matchmakerData },
    ];
    const totalItemHeight =
        items.length * (itemHeight + itemPadding) - itemPadding;

    const height =
        topPadding +
        titleHeight +
        10 +
        apiStatusLineHeight +
        10 +
        totalItemHeight +
        bottomPadding;

    const loadedIcon = await loadCS2Icon();
    const iconSize = 24;
    const iconPadding = 8;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const titleY = topPadding;
    const iconX = width - topPadding - iconSize;
    const apiStatusY = titleY + titleHeight + 10;
    const firstItemBoxY = apiStatusY + apiStatusLineHeight + 10;
    const contentWidth = width - topPadding * 2;
    const borderRadius = 4;
    const indicatorRadius = 6;
    const indicatorX = topPadding + 10 + indicatorRadius;
    const serviceNameX = indicatorX + indicatorRadius + 12;
    const statusTextX = width - topPadding - 10;

    try {
        ctx.fillStyle = "#23272A";
        ctx.fillRect(0, 0, width, height);

        const titleText = "Counter-Strike 2";
        ctx.fillStyle = "#ffffff";
        ctx.font = titleFont;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(titleText, topPadding, titleY + titleHeight / 2);

        if (loadedIcon) {
            const iconY = titleY + titleHeight / 2 - iconSize / 2;
            ctx.drawImage(loadedIcon, iconX, iconY, iconSize, iconSize);
        }

        ctx.fillStyle = "#aaaaaa";
        ctx.font = serviceFont;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
            "Status da API:",
            topPadding,
            apiStatusY + apiStatusLineHeight / 2,
        );

        ctx.fillStyle = apiStatusColor;
        ctx.font = apiStatusFont;
        ctx.textAlign = "right";
        ctx.fillText(
            apiStatusText,
            statusTextX,
            apiStatusY + apiStatusLineHeight / 2,
        );

        let currentBoxY = firstItemBoxY;
        ctx.textBaseline = "middle";

        for (const item of items) {
            const statusInfo = isApiOk
                ? getServiceStatusInfo(item.source?.[item.key])
                : getServiceStatusInfo("unknown");

            ctx.fillStyle = "#2C2F33";
            drawRoundedRect(
                ctx,
                topPadding,
                currentBoxY,
                contentWidth,
                itemHeight,
                borderRadius,
            );

            const itemCenterY = currentBoxY + itemHeight / 2;

            ctx.fillStyle = statusInfo.color;
            ctx.beginPath();
            ctx.arc(indicatorX, itemCenterY, indicatorRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#dcddde";
            ctx.font = serviceFont;
            ctx.textAlign = "left";
            ctx.fillText(item.name, serviceNameX, itemCenterY);

            ctx.fillStyle = statusInfo.color;
            ctx.font = statusFont;
            ctx.textAlign = "right";
            ctx.fillText(statusInfo.text, statusTextX, itemCenterY);

            currentBoxY += itemHeight + itemPadding;
        }

        const buffer = canvas.toBuffer("image/png");

        return buffer;
    } catch (drawError) {
        console.error(
            "[ImageGen ERROR] Error during final canvas drawing v5:",
            drawError,
        );
        throw drawError;
    }
}

module.exports = { createServicesStatusImage };
