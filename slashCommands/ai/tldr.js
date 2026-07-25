const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateAIResponse } = require('../../handlers/aiCore');
const prisma = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tldr")
        .setDescription("Rangkum pesan-pesan sebelumnya di channel ini menggunakan AI.")
        .addIntegerOption(option => 
            option.setName('jumlah')
                .setDescription('Jumlah pesan terakhir yang ingin dirangkum (10-100)')
                .setMinValue(10)
                .setMaxValue(100)
                .setRequired(false)
        ),
    name: "tldr",
    description: "Rangkum pesan-pesan sebelumnya di channel ini menggunakan AI.",
    category: "ai",
    async execute(interaction) {
        await interaction.deferReply();
        
        // Cek apakah fitur TLDR diaktifkan untuk guild ini
        let aiConfig = null;
        if (interaction.guild) {
            aiConfig = await prisma.aiSettings.findFirst({
                where: { 
                    guild: { guildId: interaction.guild.id }
                }
            }).catch(() => null);
        }

        if (aiConfig && !aiConfig.tldrEnabled) {
            return interaction.editReply("⚠️ Fitur TLDR dinonaktifkan di server ini.");
        }

        const limit = interaction.options.getInteger('jumlah') || 50;

        try {
            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: limit });
            
            // Format messages for AI (ignore bot messages and commands)
            const chatLog = messages
                .filter(m => !m.author.bot && !m.content.startsWith('/'))
                .map(m => `${m.author.username}: ${m.content}`)
                .reverse()
                .join('\n');

            if (chatLog.length === 0) {
                return interaction.editReply("Tidak ada percakapan dari pengguna (bukan bot) untuk dirangkum.");
            }

            const prompt = [
                { role: "system", content: "Kamu adalah asisten AI yang bertugas merangkum isi percakapan grup chat. Buat rangkuman dalam poin-poin yang santai dan mudah dipahami." },
                { role: "user", content: `Tolong rangkum percakapan ini:\n\n${chatLog}` }
            ];

            const summary = await generateAIResponse(prompt, 0.5);

            const embed = new EmbedBuilder()
                .setColor("#6667E4")
                .setTitle(`📝 TLDR: ${limit} Pesan Terakhir`)
                .setDescription(summary)
                .setFooter({ text: "Powered by Bytebot AI" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply("Terjadi kesalahan saat mengambil data atau menghasilkan rangkuman dari AI.");
        }
    },
};
