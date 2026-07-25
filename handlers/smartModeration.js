const { generateAIResponse } = require('./aiCore');

// Simple regex for suspicious content (links or basic bad words)
const suspiciousRegex = /(http[s]?:\/\/[^\s]+|anj[i1]ng|anjg|asu|njing|goblok|gblk|bangsat|bgst|t[0o]l[0o]l|babi|monyet|k[o0]nt[o0]l|kntl|m[e3]m[e3]k|mmk|ngentot|ngewe|peler|puki|pantek|bajingan|bego|lonte|jablay)/i;

/**
 * Menangani logika Smart Moderation
 * @param {Object} message - Discord.js Message object
 * @param {Object} aiConfig - Prisma AI Settings for the guild
 * @returns {Boolean} - true jika pesan dihapus (spam/toxic), false jika aman
 */
async function handleSmartMod(message, aiConfig) {
    if (aiConfig && aiConfig.smartModEnabled && suspiciousRegex.test(message.content)) {
        const modPrompt = [
            { role: "system", content: "Kamu adalah sistem moderasi Discord. Jawab HANYA dengan 'SPAM', 'TOXIC', atau 'SAFE' setelah menganalisis pesan ini." },
            { role: "user", content: `Pesan: "${message.content}"` }
        ];
        const verdict = await generateAIResponse(modPrompt, 0.1);
        if (verdict.includes('SPAM') || verdict.includes('TOXIC')) {
            await message.delete().catch(() => {});
            if (aiConfig.modLogChannelId) {
                const logChannel = message.guild.channels.cache.get(aiConfig.modLogChannelId);
                if (logChannel) {
                    logChannel.send(`⚠️ Dihapus oleh AI Moderation:\n**User:** ${message.author.tag}\n**Alasan:** ${verdict.trim()}\n**Isi:** ${message.content}`);
                }
            }
            return true; // Stop processing further in messageCreate
        }
    }
    return false;
}

module.exports = {
    handleSmartMod
};
