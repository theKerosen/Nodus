// index.js (or main.js)

// This file now just imports the Bot class and starts it.
const Bot = require("./src/bot"); // Assuming Bot.js is in src/

// Create an instance of the Bot
const botInstance = new Bot();

// Start the bot (loads commands, registers handlers, logs in)
botInstance.start();

// Optional: Add process-level error handling
process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    // Consider gracefully shutting down or restarting here in production
    // process.exit(1);
});
