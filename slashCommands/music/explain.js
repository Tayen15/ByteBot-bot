const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { generateAIResponse } = require('../../handlers/aiCore');
const Genius = require('genius-lyrics');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("explain")
        .setDescription("Jelaskan makna lirik dari lagu yang sedang diputar atau lagu spesifik.")
        .addStringOption(option => 
            option.setName("lagu")
                .setDescription("Judul lagu yang ingin dijelaskan (Kosongkan jika ingin menjelaskan lagu yang sedang diputar)")
                .setRequired(false)
        ),
    name: "explain",
    description: "Jelaskan makna lirik dari lagu.",
    category: "music",
    async execute(interaction) {
        await interaction.deferReply();

        let songTitle = interaction.options.getString("lagu");

        if (!songTitle) {
            const player = interaction.client.manager?.players?.get(interaction.guild.id);
            if (!player || !player.queue.current) {
                return interaction.editReply("Tidak ada lagu yang sedang diputar. Harap sebutkan judul lagunya!");
            }
            songTitle = player.queue.current.title;
        }

        try {
            // Get lyrics first
            const token = process.env.GENIUS_API_TOKEN;
            let lyricsSnippet = "";
            let artist = "";
            
            if (token) {
                const genius = new Genius.Client(token);
                const searches = await genius.songs.search(songTitle).catch(() => []);
                if (searches && searches.length > 0) {
                    const song = searches[0];
                    artist = song.artist.name;
                    const lyrics = await song.lyrics().catch(() => "");
                    if (lyrics) {
                        lyricsSnippet = lyrics.slice(0, 1000); // Send first 1000 chars for context
                    }
                }
            }

            const prompt = [
                { role: "system", content: "Kamu adalah kritikus musik dan pakar lirik. Jelaskan makna mendalam dari lagu yang diminta pengguna." },
                { role: "user", content: `Jelaskan makna lagu "${songTitle}" ${artist ? `oleh ${artist}` : ''}. ${lyricsSnippet ? `\n\nIni liriknya sebagai konteks:\n${lyricsSnippet}` : ''}` }
            ];

            const response = await generateAIResponse(prompt, 0.6);

            const embed = new EmbedBuilder()
                .setColor("#FF6B6B")
                .setTitle(`🎵 Penjelasan Makna Lagu: ${songTitle}`)
                .setDescription(response)
                .setFooter({ text: "Music Insight by Bytebot AI" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply("Gagal memanggil AI untuk menjelaskan lagu ini.");
        }
    },
};
