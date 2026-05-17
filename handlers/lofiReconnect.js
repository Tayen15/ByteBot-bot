const { getLofiSessions } = require('../utils/lofiStorage');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType } = require('@discordjs/voice');

const STREAM_URL = 'http://stream.zeno.fm/0r0xa792kwzuv';
const RECONNECT_INTERVAL = 30000; // 30 detik

module.exports = async (client) => {
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

               const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeaf: true
               });

               const player = createAudioPlayer({
                    behaviors: {
                         noSubscriber: NoSubscriberBehavior.Play,
                    }
               });

               player.on('error', (err) => {
                    console.error('❌ [LofiReconnect] Player error:' + err.message);
               });

               const resource = createAudioResource(STREAM_URL, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: false
               });

               resource.playStream.on('error', (err) => {
                    console.error('❌ [LofiReconnect] Stream error:' + err.message);
               });

               connection.subscribe(player);
               player.play(resource);

               setInterval(async () => {
                    try {
                         const status = player.state.status;
                         const res = await fetch(STREAM_URL, { method: 'HEAD' });
                         
                         if (status !== AudioPlayerStatus.Playing || !res.ok) {
                              const newResource = createAudioResource(STREAM_URL, {
                                   inputType: StreamType.Arbitrary,
                                   inlineVolume: false
                              });
                              player.play(newResource);
                         }
                    } catch (err) {
                         console.error('[LofiReconnect] Auto-reconnect check failed:', err.message);
                    }
               }, RECONNECT_INTERVAL);

               console.log('[LofiReconnect] Reconnected to ' + guild.name + ' - #' + channel.name);
          } catch (err) {
               console.error('[LofiReconnect] Error on ' + guildId + ':', err.message);
          }
     }
};
