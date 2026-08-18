const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { saveLofiSession } = require("../../utils/lofiStorage.js");

const LOFI_STREAMS = [
  "https://radio.loficafe.net/listen/studying/radio.mp3",
  "https://stream.laut.fm/lofi",
  "https://stream.laut.fm/lofi-radio",
  "https://radio.loficafe.net/listen/sleeping/radio.mp3",
  "https://azurecloud.pvtwebs.com/listen/lilo/radio.mp3",
  "https://lofiradio24.com/static/audio/sleep-lofi.mp3"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lofi")
    .setDescription("Plays 24/7 lofi music in your voice channel."),
  category: "music",
  async execute(interaction) {
    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply({
        content: "❌ Please join a voice channel first!", 
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      // Get Lavalink manager
      const manager = interaction.client.manager;

      // Create or get Lavalink player
      const player = manager.create({
        guildId: interaction.guild.id,
        voiceChannelId: channel.id,
        textChannelId: interaction.channel.id,
        volume: 100,
      });

      // Connect to voice channel
      if (player.state !== "CONNECTED") player.connect();

      player.isLofi = true;
      player.lofiStreamIndex = 0;

      // Try connecting to streams until one works
      let trackToPlay = null;
      for (let i = 0; i < LOFI_STREAMS.length; i++) {
        player.lofiStreamIndex = i;
        const res = await manager.search(LOFI_STREAMS[i], interaction.user);
        
        if (res.loadType !== "error" && res.loadType !== "empty" && res.tracks.length > 0) {
          trackToPlay = res.tracks[0];
          break; // Found a working stream!
        }
      }

      if (!trackToPlay) {
        if (!player.queue.current) player.destroy();
        return interaction.editReply({
          content:
            "❌ **Gagal memutar Lofi!**\nSemua sumber Lofi Stream saat ini sedang offline atau mengalami gangguan jaringan.\n*Saran: Coba lagi beberapa jam kedepan atau gunakan command musik biasa.*",
        });
      }

      // Add track and play
      player.queue.add(trackToPlay);

      if (!player.playing && !player.paused) {
        player.play();
      }

      saveLofiSession(interaction.guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor("#1DB954")
        .setTitle("🎧 Lofi Music")
        .setDescription(
          "Now playing **lofi** 24/7 radio in <#" + channel.id + ">",
        )
        .setFooter({ text: "Powered by Lavalink" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("❌ [Lofi] Error:", error);
      await interaction
        .editReply({
          content:
            "❌ Something went wrong while trying to play the lofi music!",
        })
        .catch(() => { });
    }
  },
};
