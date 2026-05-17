const cfg = (() => { try { return require('../config.json'); } catch { return {}; } })();
const OWNER_ID = process.env.OWNER_ID || cfg.ownerId;

function ensureAuthenticated(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
        req.user = {
            discordId: req.headers['x-discord-id'] || '',
            username: req.headers['x-discord-username'] || 'InternalAPI',
        };
        return next();
    }
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
        return next();
    }
    if (req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    return res.redirect('/auth/login');
}

function ensureBotOwner(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
        if (req.headers['x-is-owner'] === 'true') {
            return next();
        }
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (req.user && req.user.discordId === OWNER_ID) {
        return next();
    }
    if (req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    return res.redirect('/');
}

async function ensureGuildAdmin(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];
        if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
            const guildId = req.params.guildId || req.body.guildId;
            const client = req.app.get('discordClient') || req.discordClient;
            if (client && guildId) {
                const guild = client.guilds.cache.get(guildId);
                req.currentGuild = guild;
                if (guild) {
                    const prisma = require('../utils/database');
                    let dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
                    if (!dbGuild) {
                        dbGuild = await prisma.guild.create({
                            data: {
                                guildId: guild.id,
                                name: guild.name,
                                ownerId: guild.ownerId || '',
                                icon: guild.icon || null
                            }
                        });
                    }
                    req.dbGuild = dbGuild;

                    // Security: Verify permissions if requested by Next.js frontend for a specific user
                    const discordId = req.headers['x-discord-id'];
                    const isOwnerHeader = req.headers['x-is-owner'] === 'true';
                    
                    if (discordId && discordId !== OWNER_ID && !isOwnerHeader) {
                        try {
                            const member = await guild.members.fetch(discordId);
                            if (!member || (!member.permissions.has('Administrator') && !member.permissions.has('ManageGuild'))) {
                                return res.status(403).json({ success: false, error: 'Forbidden: Missing permissions in this guild' });
                            }
                            req.currentMember = member;
                        } catch (e) {
                            return res.status(403).json({ success: false, error: 'Forbidden: User not found in guild' });
                        }
                    }
                }
            }
            return next();
        }

        const guildId = req.params.guildId || req.body.guildId;
        if (!guildId) {
             return res.status(400).json({ success: false, error: 'Guild ID missing' });
        }

        const client = req.app.get('discordClient') || req.discordClient;
        if (!client) {
             return res.status(503).json({ success: false, error: 'Bot not ready' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
             return res.status(404).json({ success: false, error: 'Guild not found or bot not in guild' });
        }

        let member;
        try {
            member = await guild.members.fetch(req.user.discordId);
        } catch (e) {
            return res.status(403).json({ success: false, error: 'User is not a member of the guild' });
        }

        if (!member) {
            return res.status(403).json({ success: false, error: 'User is not a member of the guild' });
        }

        // Handle permissions
        if (member.id === OWNER_ID || member.permissions.has('Administrator') || member.permissions.has('ManageGuild')) {
             const prisma = require('../utils/database');
             let dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
             if (!dbGuild) {
                 dbGuild = await prisma.guild.create({
                     data: {
                         guildId: guild.id,
                         name: guild.name,
                         ownerId: guild.ownerId || '',
                         icon: guild.icon || null
                     }
                 });
             }
             req.dbGuild = dbGuild;
             req.currentGuild = guild;
             req.currentMember = member;
             return next();
        }

        return res.status(403).json({ success: false, error: 'Requires Administrator or Manage Guild permission' });
    } catch (e) {
        console.error('[Middleware] error in ensureGuildAdmin', e);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

function ensureBotInGuild(req, res, next) {
    const guildId = req.params.guildId || req.body.guildId;
    const client = req.app.get('discordClient') || req.discordClient;
    if (!client) {
        return res.status(503).json({ success: false, error: 'Bot is offline' });
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        return res.status(404).json({ success: false, error: 'Bot is not in this guild' });
    }
    req.currentGuild = guild;
    next();
}

module.exports = {
    ensureAuthenticated,
    ensureBotOwner,
    ensureGuildAdmin,
    ensureBotInGuild
};
