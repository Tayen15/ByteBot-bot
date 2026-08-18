const { Manager } = require("magmastream");

// Public Lavalink Nodes (Free)
const nodes = [
  {
    host: "lavalink-v2.oktaa.my.id",
    port: 443,
    password: "jejecantik",
    useSSL: true,
    maxRetryAttempts: 10,
    retryDelayMs: 5000,
  },
];

const LOFI_STREAMS = [
  "https://radio.loficafe.net/listen/studying/radio.mp3",
  "https://stream.laut.fm/lofi",
  "https://stream.laut.fm/lofi-radio",
  "https://radio.loficafe.net/listen/sleeping/radio.mp3",
  "https://azurecloud.pvtwebs.com/listen/lilo/radio.mp3",
  "https://lofiradio24.com/static/audio/sleep-lofi.mp3"
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

  const handleTrackFailure = async (player, track, payload) => {
    if (player.isLofi) {
      console.log(`⚠️ [Lavalink] Lofi track failed! Attempting fallback...`);
      player.lofiStreamIndex = (player.lofiStreamIndex + 1) % LOFI_STREAMS.length;
      const fallbackUrl = LOFI_STREAMS[player.lofiStreamIndex];
      
      try {
        const res = await client.manager.search(fallbackUrl, client.user);
        if (res.loadType !== "error" && res.loadType !== "empty" && res.tracks.length > 0) {
          console.log(`✅ [Lavalink] Fallback successful: ${fallbackUrl}`);
          player.queue.add(res.tracks[0]);
          player.play();
          return;
        }
      } catch (err) {
        console.error(`❌ [Lavalink] Fallback search error:`, err);
      }
      
      // If the immediate fallback fails, let it be. 
      // A more complex backoff could be implemented if needed.
    }
  };

  client.manager.on("trackError", handleTrackFailure);
  client.manager.on("trackStuck", handleTrackFailure);

  client.manager.on("queueEnd", (player) => {
    console.log(`⏹️ [Lavalink] Queue ended in channel ${player.voiceChannel}`);
    player.destroy();
  });
};
