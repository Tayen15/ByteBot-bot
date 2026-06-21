const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { saveLofiSession } = require("../../utils/lofiStorage.js");

// Standard Lofi Stream URL (Lofi Girl)
const STREAM_URL = "https://www.youtube.com/watch?v=qGohtGC5Rtk";

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

      // Search for the track using Magmastream
      const res = await manager.search(STREAM_URL, interaction.user);

      if (res.loadType === "error" || res.loadType === "empty") {
        if (!player.queue.current) player.destroy();
        return interaction.editReply({
          content:
            "❌ Could not find the lofi stream or Lavalink node is unavailable.",
        });
      }

      // Add track and play
      const track = res.tracks[0];
      player.queue.add(track);

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
        .catch(() => {});
    }
  },
};
