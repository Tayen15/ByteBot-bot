const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { removeLofiSession } = require('../../utils/lofiStorage');

module.exports = {
     data: new SlashCommandBuilder()
          .setName('stoplofi')
          .setDescription('Stop playing lofi and leave the voice channel'),
     category: 'music',
     async execute(interaction) {
          const guildId = interaction.guild.id;
          
          // Get the Lavalink player
          const player = interaction.client.manager.players.get(guildId);

          if (!player) {
               return interaction.reply({ content: '❌ The bot is not in a voice channel.', flags: MessageFlags.Ephemeral });
          }

          // Stop the lofi session
          removeLofiSession(guildId);

          // Disconnect from the voice channel
          player.destroy();

          const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Lofi Stopped')
                .setDescription('⛔ Lofi stopped and the bot has left the voice channel.');

          await interaction.reply({ embeds: [embed] });
     }
};
