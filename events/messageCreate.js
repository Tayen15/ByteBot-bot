const { prefix } = require('../config');
const ownerID = process.env.OWNER_ID;
const { Events } = require('discord.js');
const prisma = require('../utils/database');
const { generateAIResponse } = require('../handlers/aiCore');

// AI Rate Limiter Store
const aiRateLimits = new Map();
const COOLDOWN_LEVEL1 = 15000; // 15 seconds
const COOLDOWN_LEVEL2 = 120000; // 2 minutes
const TIMEOUT_DURATION = 3600000; // 1 hour
const MAX_DAILY_QUOTA = 50;

// Simple regex for suspicious content (links or basic bad words)
const suspiciousRegex = /(http[s]?:\/\/[^\s]+|anj[i1]ng|anjg|asu|njing|goblok|gblk|bangsat|bgst|t[0o]l[0o]l|babi|monyet|k[o0]nt[o0]l|kntl|m[e3]m[e3]k|mmk|ngentot|ngewe|peler|puki|pantek|bajingan|bego|lonte|jablay)/i;

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {

        if (message.author.bot) return;

        // Fetch AiSettings for the guild
        let aiConfig = null;
        if (message.guild) {
            aiConfig = await prisma.aiSettings.findFirst({
                where: { 
                    guild: { guildId: message.guild.id }
                }
            }).catch(() => null);
        }

        // 1. Smart Moderation
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
                return; // Stop processing further
            }
        }

        // 2. AI Chatbot
        let shouldProcessAi = false;
        let refMsg = null;


        if (aiConfig && aiConfig.chatbotEnabled) {
            const isMentioned = message.mentions.has(client.user.id);
            const inAiChannel = aiConfig.chatChannelId === message.channel.id;
            
            // Cek apakah pesan ini me-reply pesan lain
            if (message.reference && message.reference.messageId) {
                try {
                    refMsg = await message.channel.messages.fetch(message.reference.messageId);
                } catch (err) {
                    // Abaikan jika gagal mengambil pesan asli
                }
            }

            const isReplyingToBot = refMsg && refMsg.author.id === client.user.id;

            if (isMentioned || isReplyingToBot) {
                // Selalu balas jika bot di-mention atau user membalas pesan bot (di mana pun)
                shouldProcessAi = true;
            } else if (inAiChannel) {
                // Di channel khusus AI:
                if (message.reference) {
                    // Jika ini adalah reply, tapi BUKAN ke bot (karena sudah lolos if di atas),
                    // berarti user sedang membalas obrolan manusia lain. Biarkan saja.
                    shouldProcessAi = false;
                } else {
                    // Pesan biasa (tanpa reply), bot membalas
                    shouldProcessAi = true;
                }
            }
        }

        if (shouldProcessAi) {
            try {
                const textToAI = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
                
                // Jika hanya mention tanpa pesan teks dan bukan reply, beri salam standar
                if (textToAI.length === 0 && !message.reference) {
                    await message.reply("Halo! Ada yang bisa kubantu?").catch(() => {});
                    return;
                }

                if (textToAI.length > 0 || message.reference) {
                    // Check Bypass Limits (Owner or Admin)
                    const isBypassed = message.author.id === ownerID || (message.member && message.member.permissions.has('Administrator'));
                    
                    if (!isBypassed) {
                        const now = Date.now();
                        const startOfDay = new Date().setHours(0,0,0,0);
                        let userRecord = aiRateLimits.get(message.author.id) || {
                            lastMsgTime: 0,
                            strikes: 0,
                            timeoutUntil: 0,
                            dailyCount: 0,
                            dailyDate: startOfDay
                        };
                        
                        // Reset daily quota if new day
                        if (userRecord.dailyDate !== startOfDay) {
                            userRecord.dailyCount = 0;
                            userRecord.dailyDate = startOfDay;
                        }

                        // Check timeout
                        if (now < userRecord.timeoutUntil) {
                            const remainingMins = Math.ceil((userRecord.timeoutUntil - now) / 60000);
                            return message.reply(`⛔ Kamu sedang di-timeout dari AI karena spam. Coba lagi dalam ${remainingMins} menit.`).catch(() => {});
                        }

                        // Check daily quota
                        if (userRecord.dailyCount >= MAX_DAILY_QUOTA) {
                            return message.reply(`📉 Kuota pertanyaan harian AI kamu (${MAX_DAILY_QUOTA}) sudah habis! Coba lagi besok.`).catch(() => {});
                        }

                        // Check cooldown
                        let currentCooldown = userRecord.strikes === 1 ? COOLDOWN_LEVEL2 : COOLDOWN_LEVEL1;
                        if (now - userRecord.lastMsgTime < currentCooldown) {
                            userRecord.strikes += 1;
                            if (userRecord.strikes === 1) {
                                userRecord.lastMsgTime = now; // update time
                                aiRateLimits.set(message.author.id, userRecord);
                                return message.reply(`⚠️ Harap pelan-pelan! Cooldown kamu ditingkatkan menjadi 2 menit karena terindikasi spam.`).catch(() => {});
                            } else if (userRecord.strikes >= 2) {
                                userRecord.timeoutUntil = now + TIMEOUT_DURATION;
                                userRecord.strikes = 0;
                                aiRateLimits.set(message.author.id, userRecord);
                                return message.reply(`🚫 Terdeteksi pelanggaran spam berulang. Akses AI kamu diblokir sementara selama 1 jam.`).catch(() => {});
                            }
                        } else {
                            // Success, reset strikes and increment daily
                            userRecord.strikes = 0;
                            userRecord.lastMsgTime = now;
                            userRecord.dailyCount += 1;
                            aiRateLimits.set(message.author.id, userRecord);
                        }
                    }

                    await message.channel.sendTyping().catch(() => {});
                
                // 1. Dynamic Context Injection
                const nowTime = new Date();
                const timeContext = `Waktu sekarang: ${nowTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.`;
                const serverContext = message.guild ? `Info Server: Nama "${message.guild.name}", Jumlah Member: ${message.guild.memberCount}.` : "";
                const userRoles = message.member ? message.member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name).join(', ') : "Tidak ada";
                const userJoined = (message.member && message.member.joinedAt) ? message.member.joinedAt.toLocaleDateString('id-ID') : "Tidak diketahui";
                const userContext = `Info User: Nama "${message.author.username}", Roles: [${userRoles}], Bergabung: ${userJoined}.`;
                
                // 2. Context-Aware Reply (Membaca pesan yang di-reply)
                let extraContext = "";
                if (message.reference) {
                    if (!refMsg) {
                        try {
                            refMsg = await message.channel.messages.fetch(message.reference.messageId);
                        } catch (err) {}
                    }
                    if (refMsg) {
                        extraContext = `\n[Pesan dari ${refMsg.author.username} yang di-reply]: "${refMsg.content}"`;
                    }
                }

                // 3. System Prompt & Style
                const basePersona = aiConfig.persona || "Kamu adalah Bytebot, asisten Discord yang cerdas, ramah, dan sedikit lucu.";
                const styleGuide = aiConfig.responseStyle ? `\nGunakan gaya bicara: ${aiConfig.responseStyle}` : "";
                
                const systemPrompt = `${basePersona}${styleGuide}\n\n[CONTEXT DATA]\n${timeContext}\n${serverContext}\n${userContext}${extraContext}\nPastikan kamu membalas dengan natural dan tidak seperti robot yang sedang membaca data.`;

                const chatPrompt = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: textToAI || "(Merespon pesan yang di-reply)" }
                ];
                
                const replyText = await generateAIResponse(chatPrompt, aiConfig.temperature ?? 0.7);
                await message.reply(replyText).catch(() => {});
                return; 
                }
            } catch (error) {
                console.error("[AI Chatbot] Error memproses pesan:", error);
            }
        }

        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        const cmd = client.commands.get(command) || client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(command));

        if (!cmd) return;

        const commandName = cmd.name.toLowerCase();

        if (cmd.ownerOnly) {
            if (message.author.id !== ownerID) return
            message.channel.send("You dont have permissions to use this command!");
        }

        try {
            cmd.execute(client, message, args);
            client.CommandsRan++;
        }
        catch (err) {
            console.log(err);
            message.reply('An error occurred while executing the command!');
        } finally {
            console.log(`User: ${message.author.tag} | command: ${commandName} | guild: ${message.guild.id}`);
        };
    },
};