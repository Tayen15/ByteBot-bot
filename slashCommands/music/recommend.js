const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateAIResponse } = require('../../handlers/aiCore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("recommend")
        .setDescription("Dapatkan rekomendasi lagu serupa berdasarkan lagu yang sedang diputar."),
    name: "recommend",
    description: "Rekomendasi lagu dari AI.",
    category: "music",
    async execute(interaction) {
        await interaction.deferReply();

        const player = interaction.client.manager?.players?.get(interaction.guild.id);
        if (!player || !player.queue.current) {
            return interaction.editReply("Tidak ada lagu yang sedang diputar. Putar lagu terlebih dahulu agar AI bisa memberikan rekomendasi!");
        }

        const songTitle = player.queue.current.title;

        try {
            const prompt = [
                { role: "system", content: "Kamu adalah asisten musik (DJ). Berikan 5 rekomendasi lagu beserta artisnya yang mirip/satu genre dengan lagu yang disebutkan." },
                { role: "user", content: `Berikan 5 rekomendasi lagu yang mirip dengan "${songTitle}".` }
            ];

            const response = await generateAIResponse(prompt, 0.7);

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setTitle(`🎧 Rekomendasi Lagu (mirip ${songTitle})`)
                .setDescription(response)
                .setFooter({ text: "Music Recommender by Bytebot AI" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply("Gagal memanggil AI untuk mendapatkan rekomendasi.");
        }
    },
};
