const axios = require('axios');
const prisma = require('../utils/database');

const AI_API_URL = "https://router.bynara.id/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY; 

if (!AI_API_KEY) {
    console.warn("[AI Engine] Peringatan: AI_API_KEY tidak ditemukan di environment variables!");
}
/**
 * Meneruskan percakapan ke AI endpoint dan mengembalikan respon teks.
 * @param {Array} messages - Format: [{role: "system", content: "..."}, {role: "user", content: "..."}]
 * @param {Number} temperature - Kreativitas AI (0.0 to 1.0)
 * @returns {String} Teks balasan dari AI
 */
async function generateAIResponse(messages, temperature = 0.7) {
    try {
        let aiModel = "glm-5.2-free";
        try {
            const botSettings = await prisma.botSettings.findFirst();
            if (botSettings && botSettings.aiModel) {
                aiModel = botSettings.aiModel;
            }
        } catch (dbErr) {
            console.error("[AI Engine] Gagal mengambil aiModel dari database, fallback ke glm-5.2-free", dbErr);
        }

        const response = await axios.post(
            AI_API_URL,
            {
                model: aiModel,
                messages: messages,
                temperature: temperature,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_API_KEY}`
                },
                timeout: 30000 // 30 seconds timeout
            }
        );

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error("Invalid response from AI API");
        }
    } catch (error) {
        console.error("[AI Engine] Error generating response:", error?.response?.data || error.message);
        return "Maaf, kepalaku sedang pusing (sistem AI sedang gangguan). Coba lagi nanti ya!";
    }
}

module.exports = {
    generateAIResponse
};
