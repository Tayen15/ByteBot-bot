require('dotenv').config();
// Conditional slash command deployment — default OFF in production to save startup time/memory
const shouldDeploy = (process.env.DEPLOY_COMMANDS || 'false').toLowerCase() === 'true';
if (shouldDeploy) {
    try {
        require('./deploy-commands.js');
    } catch (e) {
        console.warn('⚠️  Failed to run deploy-commands.js:', e.message);
    }
} else {
    console.log('⏭️  Skipping slash command deployment (DEPLOY_COMMANDS=false)');
}
const { Client, GatewayIntentBits, Collection, Options } = require('discord.js');

const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
    console.log('🔧 Running in DEVELOPMENT mode');
} else {
    console.log('🚀 Running in PRODUCTION mode');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    // Limit Discord.js caches to reduce memory usage on Heroku
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 50,          // Limit to 50 messages per channel (default: 200)
        GuildMemberManager: {
            maxSize: 200,            // Max 200 members cached per guild
        },
    }),
    sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: {
            interval: 300,           // Sweep every 5 minutes
            lifetime: 1800,          // Remove messages older than 30 minutes
        },
        users: {
            interval: 3600,          // Sweep every hour
            filter: () => (user) => !user.bot,
        },
    },
});

client.commands = new Collection();

// Load command and event handlers (OUTSIDE forEach to register once each)
['slashCommandHandler', 'eventHandler'].forEach(handler => {
    require(`./handlers/${handler}`)(client);
});

// Load Lavalink handler
require('./handlers/lavalink.js')(client);

// Initialize background handlers - registered ONCE, after bot is ready
// NOTE: prayerTime and lofiReconnect are handled inside events/ready.js
client.once('ready', () => {
    client.manager.init({ clientId: client.user.id });
    
    // Social alerts (named export)
    try {
        const { setupSocialAlerts } = require('./handlers/socialAlert');
        setupSocialAlerts(client);
    } catch (err) {
        console.error('❌ Failed to initialize Social Alerts:', err.message);
    }

    // Server monitor
    try {
        const initMonitor = require('./handlers/monitorServer');
        if (typeof initMonitor === 'function') initMonitor(client);
    } catch (err) {
        console.error('❌ Failed to initialize Server Monitor:', err.message);
    }
});

client.login(process.env.DISCORD_TOKEN).catch(() => console.log('❌ Invalid TOKEN!'));

// Forward raw events to Lavalink Manager
client.on('raw', (d) => client.manager.updateVoiceState(d));

// Export client for use in web server
module.exports = client;
