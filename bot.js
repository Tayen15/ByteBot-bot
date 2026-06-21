require('dotenv').config();
require('./utils/logger.js');
const dns = require('dns');

// Fix Discord Voice connection issue (Connecting -> Signalling loop) on Node.js 18+
// This forces Node.js to use IPv4 instead of IPv6 for UDP connections.
dns.setDefaultResultOrder('ipv4first');

// Start Discord bot
const client = require('./index.js');

// Start web server immediately (express listen), then inject Discord client when ready
const app = require('./server.js');

client.once('ready', () => {
    console.log('✅ Discord bot is ready');
    app.setDiscordClient(client);
});

module.exports = client;
