const { prefix } = require('../config');
const ownerID = process.env.OWNER_ID;
const { Events } = require('discord.js');
const prisma = require('../utils/database');
const { handleSmartMod } = require('../handlers/smartModeration');
const { handleChatbot } = require('../handlers/aiChatbot');

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

        // 1. Smart Moderation (if returns true, it deleted the message, stop processing)
        if (await handleSmartMod(message, aiConfig)) return;

        // 2. AI Chatbot (if returns true, it processed an AI reply, stop processing commands)
        if (await handleChatbot(message, client, aiConfig)) return;

        // 3. Command Execution
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