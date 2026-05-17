const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, VoiceConnectionStatus, entersState, StreamType } = require('@discordjs/voice');
const { saveLofiSession } = require('../../utils/lofiStorage');

const STREAM_URL = 'http://stream.zeno.fm/0r0xa792kwzuv';

module.exports = {
     data: new SlashCommandBuilder()
          .setName('lofi')
          .setDescription('Play lofi music from a 24/7 stream'),
     name: 'lofi',
     category: 'music',
     async execute(interaction) {
          const channel = interaction.member.voice.channel;
          if (!channel) {
               return interaction.reply({ content: '❌ Please join a voice channel first!', flags: MessageFlags.Ephemeral });
          }

          await interaction.deferReply();

          try {
               const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    selfDeaf: true
               });

               connection.on('error', (err) => {
                    console.error('❌ [Lofi] Connection error:', err.message);
               });

               await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

               const player = createAudioPlayer({
                    behaviors: {
                         noSubscriber: NoSubscriberBehavior.Play
                    }
               });

               player.on('error', (err) => {
                    console.error('❌ [Lofi] Player error:', err.message);
               });

               const resource = createAudioResource(STREAM_URL, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: false
               });

               resource.playStream.on('error', (err) => {
                    console.error('❌ [Lofi] Stream error:', err.message);
               });

               connection.subscribe(player);
               player.play(resource);

               saveLofiSession(interaction.guild.id, channel.id);
               
               const embed = new EmbedBuilder()
                    .setColor('#1DB954')
                    .setTitle('🎧 Lofi Music')
                    .setDescription('Now playing **lofi** 24/7 radio in <#' + channel.id + '>')
                    .setFooter({ text: 'Enjoy the vibes!' })
                    .setTimestamp();

               await interaction.editReply({ embeds: [embed] });

          } catch (error) {
               console.error('❌ [Lofi] Error:', error);
               await interaction.editReply({ content: '❌ Something went wrong while trying to play the lofi music!' }).catch(() => {});
          }
     }
};
