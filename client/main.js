// main.js

const Bot = require("./src/bot");

const botInstance = new Bot();

botInstance.start();

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});
