const { Manager } = require("magmastream");

// Public Lavalink Nodes (Free)
const nodes = [
  {
    host: "192.168.123.6",
    port: 2333,
    password: "jejecantik",
    useSSL: false,
    maxRetryAttempts: 10,
    retryDelayMs: 5000,
  },
  {
    host: "https://lavalink-host.oktaa.my.id",
    port: 443,
    password: "jejecantik",
    useSSL: true,
    maxRetryAttempts: 10,
    retryDelayMs: 5000,
  },
];

module.exports = (client) => {
  client.manager = new Manager({
    nodes,
    send: (payload) => {
      const guild = client.guilds.cache.get(payload.d.guild_id);
      if (guild) {
        guild.shard.send(payload);
      }
    },
    defaultSearchPlatform: "ytsearch",
    playNextOnEnd: false, // Fix MagmaStreamError: Manager option "playNextOnEnd" must be a boolean.
    getUser: (id) => client.users.cache.get(id) || null,
    getGuild: (id) => client.guilds.cache.get(id) || null,
  });

  client.manager.on("nodeConnect", (node) => {
    console.log(
      `✅ [Lavalink] Node "${node.options.identifier || node.options.host}" connected.`,
    );
  });

  client.manager.on("nodeError", (node, error) => {
    if (error.message && error.message.includes("Session not found")) return; // Ignore harmless session expiration warning
    console.log(
      `❌ [Lavalink] Node "${node.options.identifier || node.options.host}" encountered an error: ${error.message}`,
    );
  });

  client.manager.on("trackStart", (player, track) => {
    console.log(
      `🎶 [Lavalink] Started playing: ${track.title} in channel ${player.voiceChannel}`,
    );
  });

  client.manager.on("queueEnd", (player) => {
    console.log(`⏹️ [Lavalink] Queue ended in channel ${player.voiceChannel}`);
    player.destroy();
  });
};
