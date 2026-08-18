const { getLofiSessions } = require('../utils/lofiStorage');

const LOFI_STREAMS = [
  "https://radio.loficafe.net/listen/studying/radio.mp3",
  "https://stream.laut.fm/lofi",
  "https://stream.laut.fm/lofi-radio",
  "https://radio.loficafe.net/listen/sleeping/radio.mp3",
  "https://azurecloud.pvtwebs.com/listen/lilo/radio.mp3",
  "https://lofiradio24.com/static/audio/sleep-lofi.mp3"
];

module.exports = async (client) => {
     const reconnectLogic = async () => {
          const sessions = await getLofiSessions();

          if (!sessions || sessions.length === 0) {
               console.log('[LofiReconnect] No active lofi sessions to reconnect');
               return;
          }

          for (const { guildId, channelId } of sessions) {
               try {
                    const guild = await client.guilds.fetch(guildId);
                    const channel = await guild.channels.fetch(channelId);
                    if (!channel || channel.type !== 2) continue;

                    // Reconnect via Lavalink
                    const player = client.manager.create({
                         guildId: guild.id,
                         voiceChannelId: channel.id,
                         textChannelId: channel.id, // Fallback text channel
                         volume: 100
                    });

                    if (player.state !== 'CONNECTED') player.connect();
                    player.isLofi = true;
                    player.lofiStreamIndex = 0;

                    let trackToPlay = null;
                    for (let i = 0; i < LOFI_STREAMS.length; i++) {
                         player.lofiStreamIndex = i;
                         const res = await client.manager.search(LOFI_STREAMS[i], client.user);
                         if (res.loadType !== 'error' && res.loadType !== 'empty' && res.tracks.length > 0) {
                              trackToPlay = res.tracks[0];
                              break;
                         }
                    }

                    if (!trackToPlay) {
                         console.log('[LofiReconnect] All streams failed for ' + guild.name);
                         if (!player.queue.current) player.destroy();
                         continue;
                    }

                    player.queue.add(trackToPlay);

                    if (!player.playing && !player.paused) {
                         player.play();
                    }

                    console.log('[LofiReconnect] Reconnected to ' + guild.name + ' - #' + channel.name);
               } catch (err) {
                    console.error('[LofiReconnect] Error on ' + guildId + ':', err.message);
               }
          }
     };

     // Wait for Lavalink manager to be ready
     const isConnected = [...client.manager.nodes.values()].some(node => node.connected);
     if (isConnected) {
          reconnectLogic();
     } else {
          client.manager.once('nodeConnect', reconnectLogic);
     }
};
