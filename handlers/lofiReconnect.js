const { getLofiSessions } = require('../utils/lofiStorage');

const STREAM_URL = 'https://www.youtube.com/watch?v=qGohtGC5Rtk';

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

                    const res = await client.manager.search(STREAM_URL, client.user);
                    if (res.loadType === 'error' || res.loadType === 'empty') continue;

                    player.queue.add(res.tracks[0]);

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
