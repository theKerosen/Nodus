const fs = require('fs');
const path = require('path');

class HandlerLoader {
    static loadHandlers(bot) {
        const handlersDir = path.join(__dirname, '..','..', 'handlers');
        fs.readdirSync(handlersDir).forEach(file => {
            if (file.endsWith('.js')) {
                const handler = require(path.join(handlersDir, file));
                handler(bot);
            }
        });
    }
}

module.exports = HandlerLoader;
