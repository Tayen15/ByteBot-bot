const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureGuildAdmin, ensureBotOwner, ensureBotInGuild } = require('../middleware/auth');
const prisma = require('../utils/database');
const { ActivityType } = require('discord.js');

// ===== Public API =====

router.get('/health', (req, res) => {
    const client = req.discordClient;
    if (!client) {
        return res.status(503).json({
            status: 'offline',
            message: 'Discord client not initialized'
        });
    }

    res.json({
        status: client.uptime ? 'online' : 'offline',
        uptime: client.uptime,
        ping: client.ws?.ping,
        timestamp: new Date().toISOString()
    });
});

// ===== Owner API =====

// Send announcement to all guilds or specific guild
router.post('/owner/announce', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { target, message, channelId } = req.body;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        let sentCount = 0;
        let failedGuilds = [];
        const guilds = target === 'all'
            ? Array.from(client.guilds.cache.values())
            : [client.guilds.cache.get(target)];

        for (const guild of guilds) {
            if (!guild) continue;

            let channel = null;

            // If specific channelId provided, try to use it
            if (channelId && target !== 'all') {
                channel = guild.channels.cache.get(channelId);

                // Validate channel exists and bot has permission
                if (channel && channel.type === 0) {
                    const permissions = channel.permissionsFor(guild.members.me);
                    if (!permissions || !permissions.has('SendMessages')) {
                        failedGuilds.push({
                            name: guild.name,
                            reason: 'No permission to send messages in selected channel'
                        });
                        continue;
                    }
                } else {
                    failedGuilds.push({
                        name: guild.name,
                        reason: 'Channel not found or not a text channel'
                    });
                    continue;
                }
            } else {
                // Auto-find a suitable channel (original behavior)
                channel = guild.channels.cache.find(
                    c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages')
                );
            }

            if (channel) {
                try {
                    await channel.send({
                        embeds: [{
                            title: '📢 Announcement from ByteBot Owner',
                            description: message,
                            color: 0x5865F2,
                            timestamp: new Date(),
                            footer: {
                                text: 'ByteBot Announcement System'
                            }
                        }]
                    });
                    sentCount++;
                } catch (error) {
                    failedGuilds.push({
                        name: guild.name,
                        reason: error.message
                    });
                }
            } else {
                failedGuilds.push({
                    name: guild.name,
                    reason: 'No suitable channel found'
                });
            }
        }

        res.json({
            success: true,
            message: `Announcement sent to ${sentCount} server(s)`,
            sentCount,
            failedCount: failedGuilds.length,
            failedGuilds: failedGuilds.length > 0 ? failedGuilds : undefined
        });
    } catch (error) {
        console.error('[API] Error sending announcement:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reload bot commands
router.post('/owner/reload', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        // Clear existing commands
        client.commands.clear();

        // Reload slash command handler
        require('../handlers/slashCommandHandler')(client);

        res.json({
            success: true,
            message: 'Commands reloaded successfully',
            count: client.commands.size
        });
    } catch (error) {
        console.error('[API] Error reloading commands:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Leave a guild
router.post('/owner/leave/:guildId', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const guildName = guild.name;
        await guild.leave();

        res.json({
            success: true,
            message: `Left ${guildName} successfully`
        });
    } catch (error) {
        console.error('[API] Error leaving guild:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all command toggles
router.get('/owner/commands', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const client = req.discordClient;
        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        const toggles = []; // Feature was removed from source codebase

        // Get all commands from client
        const allCommands = Array.from(client.commands.values()).map(cmd => ({
            name: cmd.name || cmd.data.name,
            category: cmd.category || 'other',
            description: cmd.data?.description || 'No description'
        }));

        // Merge with toggles
        const commandsWithStatus = allCommands.map(cmd => {
            const toggle = toggles.find(t => t.commandName === cmd.name);
            return {
                ...cmd,
                enabled: toggle ? toggle.enabled : true,
                reason: toggle ? toggle.reason : null
            };
        });

        res.json({ success: true, commands: commandsWithStatus });
    } catch (error) {
        console.error('[API] Error getting commands:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle command
router.post('/owner/commands/:commandName/toggle', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { commandName } = req.params;
        const { enabled, reason } = req.body;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        const command = client.commands.get(commandName);
        if (!command) {
            return res.status(404).json({ success: false, error: 'Command not found' });
        }

        const category = command.category || 'other';
        // await toggleCommand(commandName, enabled, category, reason); (Feature removed)

        res.json({
            success: true,
            message: `Command ${commandName} ${enabled ? 'enabled' : 'disabled'}`
        });
    } catch (error) {
        console.error('[API] Error toggling command:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get bot live stats
router.get('/owner/stats', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const client = req.discordClient;
        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }
        const [guildCount, userCount, prayerCount, monitoringCount] = await Promise.all([
            prisma.guild.count(),
            prisma.user.count(),
            prisma.prayerTime.count({ where: { enabled: true } }),
            prisma.serverMonitoring.count({ where: { enabled: true } }),
        ]);
        res.json({
            success: true,
            live: {
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                channels: client.channels.cache.size,
                ping: client.ws.ping,
                uptime: client.uptime,
            },
            db: {
                guilds: guildCount,
                users: userCount,
                prayerConfigs: prayerCount,
                monitoringConfigs: monitoringCount,
            },
        });
    } catch (error) {
        console.error('[API] Error getting stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get bot settings
router.get('/owner/settings', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        let settings = await prisma.botSettings.findFirst();

        if (!settings) {
            settings = await prisma.botSettings.create({
                data: {
                    activityType: 'Watching',
                    activityText: 'over servers',
                    status: 'online'
                }
            });
        }

        res.json({ success: true, settings });
    } catch (error) {
        console.error('[API] Error getting bot settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update bot settings
router.post('/owner/settings', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { activityType, activityText, status, maintenanceMode, maintenanceMessage } = req.body;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        // Validate and sanitize inputs
        const validActivityType = activityType && typeof activityType === 'string' ? activityType : 'Playing';
        const validActivityText = activityText && typeof activityText === 'string' && activityText.trim() !== ''
            ? activityText.trim()
            : 'over servers';
        const validStatus = status && typeof status === 'string' ? status : 'online';

        // Update or create settings
        let settings = await prisma.botSettings.findFirst();

        if (settings) {
            settings = await prisma.botSettings.update({
                where: { id: settings.id },
                data: {
                    activityType: validActivityType,
                    activityText: validActivityText,
                    status: validStatus,
                    maintenanceMode,
                    maintenanceMessage
                }
            });
        } else {
            settings = await prisma.botSettings.create({
                data: {
                    activityType: validActivityType,
                    activityText: validActivityText,
                    status: validStatus,
                    maintenanceMode,
                    maintenanceMessage
                }
            });
        }

        // Update bot presence immediately
        const activityTypeMap = {
            'Playing': ActivityType.Playing,
            'Streaming': ActivityType.Streaming,
            'Listening': ActivityType.Listening,
            'Watching': ActivityType.Watching,
            'Custom': ActivityType.Custom,
            'Competing': ActivityType.Competing
        };
        const activityTypeEnum = activityTypeMap[validActivityType] || ActivityType.Playing;

        // Build activity object
        // NOTE: Discord.js ALWAYS requires 'name' property, even for Custom status
        // For Custom status, Discord.js will automatically convert 'name' to 'state'
        // See: discord.js/src/structures/ClientPresence.js lines 58-61
        const activity = {
            type: activityTypeEnum,
            name: validActivityText  // Always use 'name', Discord.js handles Custom conversion
        };

        client.user.setPresence({
            activities: [activity],
            status: validStatus
        });

        res.json({ success: true, settings, message: 'Bot settings updated' });
    } catch (error) {
        console.error('[API] Error updating bot settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get lofi sessions
router.get('/owner/lofi', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const sessions = await prisma.lofiSession.findMany({
            where: { isActive: true },
            include: {
                guild: true
            }
        });

        res.json({ success: true, sessions });
    } catch (error) {
        console.error('[API] Error getting lofi sessions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get channels for a guild (Owner only)
router.get('/owner/guild/:guildId/channels', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Get text channels where bot has permission to send messages
        const textChannels = Array.from(guild.channels.cache.values())
            .filter(channel => {
                if (channel.type !== 0) return false; // Only text channels
                const permissions = channel.permissionsFor(guild.members.me);
                return permissions && permissions.has('SendMessages');
            })
            .map(channel => ({
                id: channel.id,
                name: channel.name,
                position: channel.position
            }))
            .sort((a, b) => a.position - b.position);

        res.json({ success: true, channels: textChannels });
    } catch (error) {
        console.error('[API] Error getting guild channels:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Guild Settings API =====

// Get guild info (member count, etc.)
router.get('/guild/:guildId/info', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not connected' });
        }

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        res.json({
            success: true,
            memberCount: discordGuild.memberCount,
            name: discordGuild.name,
            icon: discordGuild.icon
        });
    } catch (error) {
        console.error('[API] Error getting guild info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get guild features (global toggles + guild-specific active states)
router.get('/guild/:guildId/features', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        
        // Parallel fetch for global feature toggles AND this guild's specific configurations
        const [
            globalFeatures,
            prayer,
            welcome,
            rules,
            alertsCount,
            monitorsCount
        ] = await Promise.all([
            prisma.featureToggle.findMany(),
            prisma.prayerTime.findFirst({ where: { guildId: req.dbGuild.id } }),
            prisma.welcomeConfig.findUnique({ where: { guildId: req.dbGuild.id } }),
            prisma.rule.findFirst({ where: { guildId: req.dbGuild.id } }),
            prisma.socialAlert.count({ where: { guildId: req.dbGuild.id } }),
            prisma.serverMonitoring.count({ where: { guildId: req.dbGuild.id } })
        ]);

        // Map global toggles
        const globalConfig = globalFeatures.reduce((acc, f) => {
            acc[f.featureKey] = f.enabled;
            return acc;
        }, {});

        // Build feature states for the UI
        const features = {
            // Only enabled if globally enabled (default true if not defined)
            prayer_times: globalConfig.prayer_times !== false,
            welcome_message: globalConfig.welcome_message !== false,
            rules_management: globalConfig.rules_management !== false,
            social_alerts: globalConfig.social_alerts !== false,
            server_monitoring: globalConfig.server_monitoring !== false,
            
            // Guild-specific active states — true if feature has been configured for this guild
            active_states: {
                 prayer_times: !!prayer,        // has prayer config (regardless of enabled flag)
                 welcome_message: !!welcome,    // has welcome config
                 rules_management: !!rules,     // has at least one rule
                 social_alerts: alertsCount > 0,
                 server_monitoring: monitorsCount > 0
            }
        };

        res.json({ success: true, features });
    } catch (error) {
        console.error('[API] Error getting guild features:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get guild settings
router.get('/guild/:guildId/settings', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        let settings = await prisma.guildSettings.findUnique({
            where: { guildId: req.dbGuild.id }
        });

        if (!settings) {
            settings = await prisma.guildSettings.create({
                data: { guildId: req.dbGuild.id }
            });
        }

        res.json({ success: true, settings });
    } catch (error) {
        console.error('[API] Error getting guild settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update guild settings
router.post('/guild/:guildId/settings', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const updates = req.body;

        const settings = await prisma.guildSettings.upsert({
            where: { guildId: req.dbGuild.id },
            update: updates,
            create: {
                guildId: req.dbGuild.id,
                ...updates
            }
        });

        res.json({ success: true, settings });
    } catch (error) {
        console.error('[API] Error updating guild settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Prayer Times API =====

// Get prayer times config
router.get('/guild/:guildId/prayer', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        let prayerConfig = await prisma.prayerTime.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        if (!prayerConfig) {
            prayerConfig = await prisma.prayerTime.create({
                data: { guildId: req.dbGuild.id }
            });
        }

        res.json({ success: true, prayerConfig });
    } catch (error) {
        console.error('[API] Error getting prayer config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update prayer times config
router.post('/guild/:guildId/prayer', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const updates = req.body;

        // Get existing config to check if message needs to be deleted
        const existingConfig = await prisma.prayerTime.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        // Convert string booleans to actual booleans
        const data = {
            enabled: updates.enabled === 'true' || updates.enabled === true,
            city: updates.city,
            country: updates.country,
            channelId: updates.channelId || null,
            method: parseInt(updates.method) || 20,
            notifyFajr: updates.notifyFajr === 'true' || updates.notifyFajr === true,
            notifyDhuhr: updates.notifyDhuhr === 'true' || updates.notifyDhuhr === true,
            notifyAsr: updates.notifyAsr === 'true' || updates.notifyAsr === true,
            notifyMaghrib: updates.notifyMaghrib === 'true' || updates.notifyMaghrib === true,
            notifyIsha: updates.notifyIsha === 'true' || updates.notifyIsha === true,
            customMessage: updates.customMessage || null
        };

        // If disabling prayer times, delete the existing message
        if (!data.enabled && existingConfig?.lastMessageId && existingConfig?.channelId) {
            const client = req.app.get('discordClient');
            if (client) {
                try {
                    const channel = await client.channels.fetch(existingConfig.channelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(existingConfig.lastMessageId).catch(() => null);
                        if (message) {
                            await message.delete();
                            console.log(`[Prayer] Deleted message ${existingConfig.lastMessageId} for guild ${guild.guildId}`);
                        }
                    }
                } catch (error) {
                    console.error('[Prayer] Error deleting message:', error);
                }
            }

            // Clear lastMessageId from database
            data.lastMessageId = null;

            // Stop monitoring
            const { stopPrayerMonitoring } = require('../handlers/prayerTime');
            stopPrayerMonitoring(guild.guildId);
        }

        const prayerConfig = await prisma.prayerTime.updateMany({
            where: { guildId: req.dbGuild.id },
            data
        });

        if (prayerConfig.count === 0) {
            await prisma.prayerTime.create({
                data: {
                    guildId: req.dbGuild.id,
                    ...data
                }
            });
        }

        // Trigger prayer monitoring update if enabled
        if (data.enabled && data.channelId) {
            const { startPrayerMonitoring } = require('../handlers/prayerTime');
            const client = req.app.get('discordClient');
            if (client) {
                await startPrayerMonitoring(client, guild.guildId);
            }
        }

        // Check if request is from form (redirect) or API (JSON)
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            // Form submission - redirect to dashboard
            return res.redirect(`/dashboard/guild/${guild.guildId}/prayer`);
        }

        // API request - return JSON
        res.json({ success: true, message: 'Prayer times updated successfully' });
    } catch (error) {
        console.error('[API] Error updating prayer config:', error);

        // Check if request is from form
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect(`/dashboard/guild/${req.params.guildId}/prayer?error=update_failed`);
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Server Monitoring API =====

// Get monitoring configs
router.get('/guild/:guildId/monitoring', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const monitors = await prisma.serverMonitoring.findMany({
            where: { guildId: req.dbGuild.id }
        });

        res.json({ success: true, monitors });
    } catch (error) {
        console.error('[API] Error getting monitors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create or Update monitoring config
router.post('/guild/:guildId/monitoring', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const body = req.body;

        // Check if monitoring config exists
        const existing = await prisma.serverMonitoring.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        // Convert string booleans to actual booleans and integers
        const data = {
            enabled: body.enabled === 'true' || body.enabled === true,
            type: body.type || 'minecraft',
            channelId: body.channelId || null,

            // Minecraft fields
            serverHost: body.serverHost || null,
            serverPort: parseInt(body.serverPort) || 25565,
            serverName: body.serverName || null,
            checkInterval: parseInt(body.checkInterval) || 5,

            // Notification settings
            notifyOnline: body.notifyOnline === 'true' || body.notifyOnline === true,
            notifyOffline: body.notifyOffline === 'true' || body.notifyOffline === true,
            notifyPlayerCount: body.notifyPlayerCount === 'true' || body.notifyPlayerCount === true,

            // Uptime/Pterodactyl fields
            uptimeApiKey: body.uptimeApiKey || null,
            pterodactylUrl: body.pterodactylUrl || null,
            pterodactylApiKey: body.pterodactylApiKey || null,
            serverId: body.serverId || null,
            updateInterval: parseInt(body.updateInterval) || 60000
        };

        // If disabling monitoring, delete the existing message
        if (!data.enabled && existing?.lastMessageId && existing?.channelId) {
            const client = req.app.get('discordClient');
            if (client) {
                try {
                    const channel = await client.channels.fetch(existing.channelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(existing.lastMessageId).catch(() => null);
                        if (message) {
                            await message.delete();
                            console.log(`[Monitoring] Deleted message ${existing.lastMessageId} for guild ${guild.guildId}`);
                        }
                    }
                } catch (error) {
                    console.error('[Monitoring] Error deleting message:', error);
                }
            }

            // Clear lastMessageId from database
            data.lastMessageId = null;

            // Stop monitoring
            const { stopServerMonitoring } = require('../handlers/monitorServer');
            stopServerMonitoring(guild.guildId);
        }

        let monitor;
        if (existing) {
            // Update existing
            monitor = await prisma.serverMonitoring.update({
                where: { id: existing.id },
                data
            });
        } else {
            // Create new
            monitor = await prisma.serverMonitoring.create({
                data: {
                    guildId: req.dbGuild.id,
                    ...data
                }
            });
        }

        // Trigger monitoring update if enabled
        if (data.enabled && data.channelId) {
            const { startServerMonitoring } = require('../handlers/monitorServer');
            const client = req.app.get('discordClient');
            if (client) {
                await startServerMonitoring(client, guild.guildId);
            }
        }

        // Check if request is from form (redirect) or API (JSON)
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect(`/dashboard/guild/${guild.guildId}/monitoring`);
        }

        res.json({ success: true, monitor });
    } catch (error) {
        console.error('[API] Error saving monitor:', error);

        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect(`/dashboard/guild/${req.params.guildId}/monitoring?error=save_failed`);
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

// Update monitoring config
router.put('/guild/:guildId/monitoring/:id', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;

        // Convert string booleans to actual booleans and integers
        const data = {
            enabled: body.enabled === 'true' || body.enabled === true,
            type: body.type,
            channelId: body.channelId || null,

            // Minecraft fields
            serverHost: body.serverHost || null,
            serverPort: body.serverPort ? parseInt(body.serverPort) : undefined,
            serverName: body.serverName || null,
            checkInterval: body.checkInterval ? parseInt(body.checkInterval) : undefined,

            // Notification settings
            notifyOnline: body.notifyOnline === 'true' || body.notifyOnline === true,
            notifyOffline: body.notifyOffline === 'true' || body.notifyOffline === true,
            notifyPlayerCount: body.notifyPlayerCount === 'true' || body.notifyPlayerCount === true,

            // Uptime/Pterodactyl fields
            uptimeApiKey: body.uptimeApiKey || undefined,
            pterodactylUrl: body.pterodactylUrl || undefined,
            pterodactylApiKey: body.pterodactylApiKey || undefined,
            serverId: body.serverId || undefined,
            updateInterval: body.updateInterval ? parseInt(body.updateInterval) : undefined
        };

        const monitor = await prisma.serverMonitoring.update({
            where: { id },
            data
        });

        res.json({ success: true, monitor });
    } catch (error) {
        console.error('[API] Error updating monitor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete monitoring config
router.delete('/guild/:guildId/monitoring/:id', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.serverMonitoring.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Monitor deleted successfully' });
    } catch (error) {
        console.error('[API] Error deleting monitor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Rules API =====

// Get rules
router.get('/guild/:guildId/rules', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const rulesConfig = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        res.json({ success: true, rulesConfig });
    } catch (error) {
        console.error('[API] Error getting rules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Rules API =====

// Get rules config
router.get('/guild/:guildId/rules', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const rulesConfig = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        res.json({
            success: true,
            rulesConfig,
            rules: rulesConfig?.rules || []
        });
    } catch (error) {
        console.error('[API] Error getting rules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get individual rule
router.get('/guild/:guildId/rules/:ruleId', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const { ruleId } = req.params;

        const rulesConfig = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        if (!rulesConfig) {
            return res.status(404).json({ success: false, error: 'Rules not found' });
        }

        const rules = Array.isArray(rulesConfig.rules) ? rulesConfig.rules : [];
        const rule = rules.find(r => r.id === ruleId);

        if (!rule) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }

        res.json({ success: true, ...rule });
    } catch (error) {
        console.error('[API] Error getting rule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create/Add new rule
router.post('/guild/:guildId/rules', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, error: 'Title and description are required' });
        }

        const existing = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        const newRule = {
            id: Date.now().toString(), // Simple ID generation
            title,
            description
        };

        let rulesConfig;
        if (existing) {
            const currentRules = Array.isArray(existing.rules) ? existing.rules : [];
            currentRules.push(newRule);

            rulesConfig = await prisma.rule.update({
                where: { id: existing.id },
                data: { rules: currentRules }
            });
        } else {
            rulesConfig = await prisma.rule.create({
                data: {
                    guildId: req.dbGuild.id,
                    rules: [newRule]
                }
            });
        }

        res.json({ success: true, rule: newRule, rulesConfig });
    } catch (error) {
        console.error('[API] Error creating rule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Welcome Message Settings
router.get('/guild/:guildId/welcome', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const welcomeConfig = await prisma.welcomeConfig.findUnique({
            where: { guildId: req.dbGuild.id }
        });
        res.json({ success: true, welcomeConfig });
    } catch (error) {
        console.error('[API] Error getting welcome config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save Welcome Message Settings
router.post('/guild/:guildId/welcome', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;

        // Debug log to check req.body
        console.log('📝 Received welcome config update:', {
            hasBody: !!req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            contentType: req.headers['content-type']
        });

        // Ensure req.body exists
        if (!req.body || Object.keys(req.body).length === 0) {
            console.error('❌ req.body is empty or undefined');
            return res.status(400).json({
                success: false,
                error: 'No data received. Please check form submission.'
            });
        }

        const {
            enabled, channelId, message, embedTitle, embedDescription, embedColor, imageUrl, dmEnabled, autoRoleId,
            useCustomImage, layout, font, circleColor, titleColor, usernameColor, messageColor, overlayColor, bgImageUrl, bgColor, avatarShape, overlayOpacity, memberCountText
        } = req.body;

        await prisma.welcomeConfig.upsert({
            where: { guildId: req.dbGuild.id },
            update: {
                enabled: enabled === 'true' || enabled === true,
                channelId: channelId || null,
                message: message || null,
                embedTitle: embedTitle || null,
                embedDescription: embedDescription || null,
                embedColor: embedColor || null,
                imageUrl: imageUrl || null,
                dmEnabled: dmEnabled === 'true' || dmEnabled === true,
                autoRoleId: autoRoleId || null,
                useCustomImage: useCustomImage === 'true' || useCustomImage === true,
                layout: layout || 'classic',
                font: font || 'Discord',
                circleColor: circleColor || null,
                titleColor: titleColor || null,
                usernameColor: usernameColor || null,
                messageColor: messageColor || null,
                overlayColor: overlayColor || null,
                bgImageUrl: bgImageUrl || null,
                bgColor: bgColor || null,
                avatarShape: avatarShape || 'circle',
                overlayOpacity: overlayOpacity ? parseInt(overlayOpacity) : 50,
                memberCountText: memberCountText || null,
            },
            create: {
                guildId: req.dbGuild.id,
                enabled: enabled === 'true' || enabled === true,
                channelId: channelId || null,
                message: message || null,
                embedTitle: embedTitle || null,
                embedDescription: embedDescription || null,
                embedColor: embedColor || null,
                imageUrl: imageUrl || null,
                dmEnabled: dmEnabled === 'true' || dmEnabled === true,
                autoRoleId: autoRoleId || null,
                useCustomImage: useCustomImage === 'true' || useCustomImage === true,
                layout: layout || 'classic',
                font: font || 'Discord',
                circleColor: circleColor || null,
                titleColor: titleColor || null,
                usernameColor: usernameColor || null,
                messageColor: messageColor || null,
                overlayColor: overlayColor || null,
                bgImageUrl: bgImageUrl || null,
                bgColor: bgColor || null,
                avatarShape: avatarShape || 'circle',
                overlayOpacity: overlayOpacity ? parseInt(overlayOpacity) : 50,
                memberCountText: memberCountText || null,
            }
        });

        // Check if it's AJAX request (for dashboard form submission)
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.json({ success: true, message: 'Welcome settings saved successfully' });
        }

        res.redirect(`/dashboard/guild/${guild.guildId}/welcome?success=${encodeURIComponent('Welcome settings saved')}`);
    } catch (error) {
        console.error('❌ Error saving welcome settings:', error);
        res.redirect(`/dashboard/guild/${req.params.guildId}/welcome?error=${encodeURIComponent('Failed to save settings')}`);
    }
});

// Update existing rule
router.put('/guild/:guildId/rules/:ruleId', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const { ruleId } = req.params;
        const { title, description } = req.body;

        const rulesConfig = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        if (!rulesConfig) {
            return res.status(404).json({ success: false, error: 'Rules not found' });
        }

        const rules = Array.isArray(rulesConfig.rules) ? rulesConfig.rules : [];
        const ruleIndex = rules.findIndex(r => r.id === ruleId);

        if (ruleIndex === -1) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }

        rules[ruleIndex] = {
            id: ruleId,
            title,
            description
        };

        const updated = await prisma.rule.update({
            where: { id: rulesConfig.id },
            data: { rules }
        });

        res.json({ success: true, rule: rules[ruleIndex], rulesConfig: updated });
    } catch (error) {
        console.error('[API] Error updating rule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete rule
router.delete('/guild/:guildId/rules/:ruleId', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const { ruleId } = req.params;

        const rulesConfig = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        if (!rulesConfig) {
            return res.status(404).json({ success: false, error: 'Rules not found' });
        }

        const rules = Array.isArray(rulesConfig.rules) ? rulesConfig.rules : [];
        const filtered = rules.filter(r => r.id !== ruleId);

        const updated = await prisma.rule.update({
            where: { id: rulesConfig.id },
            data: { rules: filtered }
        });

        res.json({ success: true, rulesConfig: updated });
    } catch (error) {
        console.error('[API] Error deleting rule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update rules config (channel, webhook, etc)
router.put('/guild/:guildId/rules/config', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const guild = req.currentGuild;
        const { channelId, webhookUrl } = req.body;

        const existing = await prisma.rule.findFirst({
            where: { guildId: req.dbGuild.id }
        });

        let rulesConfig;
        if (existing) {
            rulesConfig = await prisma.rule.update({
                where: { id: existing.id },
                data: { channelId, webhookUrl }
            });
        } else {
            rulesConfig = await prisma.rule.create({
                data: {
                    guildId: req.dbGuild.id,
                    channelId,
                    webhookUrl,
                    rules: []
                }
            });
        }

        res.json({ success: true, rulesConfig });
    } catch (error) {
        console.error('[API] Error updating rules config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Guild Channels API (for dropdowns) =====

// Get channels for a specific guild (for admin dashboard)
router.get('/guild/:guildId/channels', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const channels = guild.channels.cache
            .filter(c => c.type === 0 || c.type === 2) // Text or Voice channels
            .map(c => ({
                id: c.id,
                name: c.name,
                type: c.type === 0 ? 'text' : 'voice'
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, channels });
    } catch (error) {
        console.error('[API] Error getting channels:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get roles for a guild
router.get('/guild/:guildId/roles', ensureAuthenticated, ensureBotInGuild, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const roles = guild.roles.cache
            .filter(r => !r.managed && r.name !== '@everyone')
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, roles });
    } catch (error) {
        console.error('[API] Error getting roles:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get channels for owner dashboard (for specific guild)
router.get('/owner/guild/:guildId/channels', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Get text channels where bot has permission to send messages
        const channels = guild.channels.cache
            .filter(c => {
                if (c.type !== 0) return false; // Only text channels
                const permissions = c.permissionsFor(guild.members.me);
                return permissions && permissions.has('SendMessages');
            })
            .map(c => ({
                id: c.id,
                name: c.name,
                type: 'text'
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, channels });
    } catch (error) {
        console.error('[API] Error getting channels:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get detailed server information for owner
router.get('/owner/servers/:guildId', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Fetch owner info if not cached (avoids rate limit from fetching all members)
        if (!guild.members.cache.has(guild.ownerId)) {
            try {
                await guild.members.fetch(guild.ownerId);
            } catch (err) {
                console.warn(`[API] Rate limit/Error fetching owner for guild ${guildId}:`, err.message);
            }
        }

        // Get server info
        const serverInfo = {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true, size: 256 }),
            owner: {
                id: guild.ownerId,
                username: guild.members.cache.get(guild.ownerId)?.user?.username || 'Unknown',
                tag: guild.members.cache.get(guild.ownerId)?.user?.tag || 'Unknown'
            },
            memberCount: guild.memberCount,
            createdAt: guild.createdAt,
            joinedAt: guild.joinedAt,
            description: guild.description,
            verificationLevel: guild.verificationLevel,
            boostTier: guild.premiumTier,
            boostCount: guild.premiumSubscriptionCount,
            channels: {
                total: guild.channels.cache.size,
                text: guild.channels.cache.filter(c => c.type === 0).size,
                voice: guild.channels.cache.filter(c => c.type === 2).size,
                category: guild.channels.cache.filter(c => c.type === 4).size
            },
            roles: guild.roles.cache.size,
            emojis: guild.emojis.cache.size,
            features: guild.features
        };

        res.json({ success: true, server: serverInfo });
    } catch (error) {
        console.error('[API] Error getting server info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get members list for a specific server
router.get('/owner/servers/:guildId/members', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { page = 1, limit = 50, search = '' } = req.query;
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Try to fetch members if cache isn't fully populated, but handle rate limits
        try {
            if (guild.members.cache.size < guild.memberCount) {
                // If it's a huge guild, this still might hit intents/limits or take long
                // but at least we catch the GatewayRateLimitError
                await guild.members.fetch({ time: 10000 });
            }
        } catch (err) {
            console.warn(`[API] Rate limit/Time out fetching members for ${guildId}, using cache.`, err.message);
        }

        // Get all members
        let members = Array.from(guild.members.cache.values());

        // Filter by search if provided
        if (search) {
            const searchLower = search.toLowerCase();
            members = members.filter(m =>
                m.user.username.toLowerCase().includes(searchLower) ||
                m.user.tag.toLowerCase().includes(searchLower) ||
                m.displayName.toLowerCase().includes(searchLower)
            );
        }

        // Sort by join date (newest first)
        members.sort((a, b) => b.joinedTimestamp - a.joinedTimestamp);

        // Pagination
        const total = members.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedMembers = members.slice(startIndex, endIndex);

        // Format member data
        const memberList = paginatedMembers.map(member => ({
            id: member.id,
            username: member.user.username,
            tag: member.user.tag,
            discriminator: member.user.discriminator,
            displayName: member.displayName,
            avatar: member.user.displayAvatarURL({ dynamic: true, size: 128 }),
            isBot: member.user.bot,
            isOwner: member.id === guild.ownerId,
            joinedAt: member.joinedAt,
            roles: member.roles.cache
                .filter(r => r.id !== guild.id) // Exclude @everyone
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
                .sort((a, b) => b.position - a.position),
            permissions: {
                isAdmin: member.permissions.has('Administrator'),
                canManageGuild: member.permissions.has('ManageGuild'),
                canManageChannels: member.permissions.has('ManageChannels'),
                canKick: member.permissions.has('KickMembers'),
                canBan: member.permissions.has('BanMembers')
            }
        }));

        res.json({
            success: true,
            members: memberList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[API] Error getting members:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all servers list for owner dashboard
router.get('/owner/servers', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const client = req.discordClient;

        if (!client) {
            return res.status(503).json({ success: false, error: 'Bot is not ready' });
        }

        const servers = Array.from(client.guilds.cache.values()).map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true, size: 128 }),
            memberCount: guild.memberCount,
            owner: {
                id: guild.ownerId,
                username: guild.members.cache.get(guild.ownerId)?.user?.username || 'Unknown'
            },
            joinedAt: guild.joinedAt,
            boostTier: guild.premiumTier
        })).sort((a, b) => b.memberCount - a.memberCount); // Sort by member count

        res.json({ success: true, servers, total: servers.length });
    } catch (error) {
        console.error('[API] Error getting servers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== Social Alert API =====

// Get social alerts for a guild
router.get('/guild/:guildId/social-alert', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId } = req.params;
        const guild = await prisma.guild.findUnique({ where: { guildId } });
        if (!guild) {
            return res.json({ success: true, alerts: [] });
        }
        const alerts = await prisma.socialAlert.findMany({ where: { guildId: req.dbGuild.id } });
        res.json({ success: true, alerts });
    } catch (error) {
        console.error('❌ Error getting social alerts:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Guard: normalize check interval into safe presets (minutes)
function normalizeCheckInterval(body) {
    try {
        const speed = (body?.checkIntervalSpeed || '').toString().toLowerCase();
        if (speed === 'fast') return 5;
        if (speed === 'slow') return 15;

        const raw = parseInt(body?.checkInterval, 10);
        if (Number.isFinite(raw)) {
            // Any value <= 7 minutes counts as fast; otherwise slow
            return raw <= 7 ? 5 : 15;
        }
        // Default to slow to reduce rate-limit risk
        return 15;
    } catch {
        return 15;
    }
}

// Create new social alert
router.post('/guild/:guildId/social-alert', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { platform, username, channelUrl, channelId, notifyLive, notifyVideo, notifyPost, customRole, embedColor } = req.body;

        const safeInterval = normalizeCheckInterval(req.body);

        const guild = await prisma.guild.findUnique({ where: { guildId } });
        if (!guild) {
            return res.status(404).json({ success: false, message: 'Guild not found' });
        }

        // Validate channel exists
        const client = req.discordClient;
        const discordGuild = client?.guilds?.cache.get(guildId);
        if (channelId && !discordGuild?.channels?.cache.has(channelId)) {
            return res.status(400).json({ success: false, message: 'Channel not found' });
        }

        const alert = await prisma.socialAlert.create({
            data: {
                guildId: req.dbGuild.id,
                platform,
                username: username || null,
                channelUrl: channelUrl || null,
                channelId: channelId || null,
                notifyLive: notifyLive === 'true',
                notifyVideo: notifyVideo === 'true',
                notifyPost: notifyPost === 'true',
                customRole: customRole || null,
                embedColor: embedColor || '#5865F2',
                checkInterval: safeInterval
            }
        });

        // Reload guild alerts to start monitoring
        try {
            const { reloadGuildAlerts } = require('../handlers/socialAlert');
            reloadGuildAlerts(client, guild.id);
        } catch (e) {
            console.warn('⚠️  Failed to reload guild alerts after create:', e.message);
        }

        res.json({ success: true, message: 'Social alert created successfully', alert });
    } catch (error) {
        console.error('❌ Error creating social alert:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update social alert
router.put('/guild/:guildId/social-alert/:alertId', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId, alertId } = req.params;
        const { enabled, platform, username, channelUrl, channelId, notifyLive, notifyVideo, notifyPost, customRole, embedColor } = req.body;

        const safeInterval = normalizeCheckInterval(req.body);

        const guild = await prisma.guild.findUnique({ where: { guildId } });
        if (!guild) {
            return res.status(404).json({ success: false, message: 'Guild not found' });
        }

        // Validate channel exists
        const client = req.discordClient;
        const discordGuild = client?.guilds?.cache.get(guildId);
        if (channelId && !discordGuild?.channels?.cache.has(channelId)) {
            return res.status(400).json({ success: false, message: 'Channel not found' });
        }

        const alert = await prisma.socialAlert.update({
            where: { id: alertId },
            data: {
                enabled: enabled === 'true',
                platform,
                username: username || null,
                channelUrl: channelUrl || null,
                channelId: channelId || null,
                notifyLive: notifyLive === 'true',
                notifyVideo: notifyVideo === 'true',
                notifyPost: notifyPost === 'true',
                customRole: customRole || null,
                embedColor: embedColor || '#5865F2',
                checkInterval: safeInterval
            }
        });

        // Reload guild alerts to update monitoring
        try {
            const { reloadGuildAlerts } = require('../handlers/socialAlert');
            reloadGuildAlerts(client, guild.id);
        } catch (e) {
            console.warn('⚠️  Failed to reload guild alerts after update:', e.message);
        }

        res.json({ success: true, message: 'Social alert updated successfully', alert });
    } catch (error) {
        console.error('❌ Error updating social alert:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Delete social alert
router.delete('/guild/:guildId/social-alert/:alertId', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
    try {
        const { alertId } = req.params;

        // Get alert before deleting
        const alert = await prisma.socialAlert.findUnique({ where: { id: alertId } });
        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        // Stop monitoring for this alert
        try {
            const { stopMonitoring } = require('../handlers/socialAlert');
            stopMonitoring(alertId);
        } catch (e) {
            console.warn('⚠️  Failed to stop monitoring before delete:', e.message);
        }

        await prisma.socialAlert.delete({ where: { id: alertId } });
        res.json({ success: true, message: 'Social alert deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting social alert:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Toggle social alert
router.patch('/guild/:guildId/social-alert/:alertId/toggle', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
    try {
        const { guildId, alertId } = req.params;
        const { enabled } = req.body;

        const alert = await prisma.socialAlert.update({
            where: { id: alertId },
            data: { enabled: enabled === 'true' }
        });

        // Reload guild alerts to start/stop monitoring
        try {
            const client = req.discordClient;
            const guild = await prisma.guild.findFirst({ where: { guildId } });
            if (guild) {
                const { reloadGuildAlerts } = require('../handlers/socialAlert');
                reloadGuildAlerts(client, guild.id);
            }
        } catch (e) {
            console.warn('⚠️  Failed to reload guild alerts after toggle:', e.message);
        }

        res.json({ success: true, message: `Social alert ${alert.enabled ? 'enabled' : 'disabled'}`, alert });
    } catch (error) {
        console.error('❌ Error toggling social alert:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ===== Feature Toggle API (Owner Only) =====

// Get all features
router.get('/owner/features', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const features = await prisma.featureToggle.findMany();
        res.json({ success: true, features });
    } catch (error) {
        console.error('❌ Error fetching features:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Toggle feature on/off
router.patch('/owner/features/:featureKey/toggle', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { featureKey } = req.params;
        const { enabled } = req.body;

        const feature = await prisma.featureToggle.update({
            where: { featureKey },
            data: { enabled: enabled === true || enabled === 'true' }
        });

        res.json({
            success: true,
            message: `${feature.name} ${feature.enabled ? 'enabled' : 'disabled'}`,
            feature
        });
    } catch (error) {
        console.error('❌ Error toggling feature:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update feature details
router.put('/owner/features/:featureKey', ensureAuthenticated, ensureBotOwner, async (req, res) => {
    try {
        const { featureKey } = req.params;
        const { name, description, category, icon } = req.body;

        const feature = await prisma.featureToggle.update({
            where: { featureKey },
            data: { name, description, category, icon }
        });

        res.json({
            success: true,
            message: 'Feature updated successfully',
            feature
        });
    } catch (error) {
        console.error('❌ Error updating feature:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Owner: Live active memory logs
router.get('/owner/logs/live', ensureAuthenticated, ensureBotOwner, (req, res) => {
    res.json({ success: true, logs: global.recentLogs || [] });
});

// Owner: Get logs list
router.get('/owner/logs', ensureAuthenticated, ensureBotOwner, (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            return res.json({ success: true, files: [] });
        }
        const files = fs.readdirSync(logsDir).map(file => {
            const stats = fs.statSync(path.join(logsDir, file));
            return { name: file, size: stats.size, modified: stats.mtime.toISOString() };
        }).sort((a,b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        
        res.json({ success: true, files });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Owner: View specific log
router.get('/owner/logs/:filename', ensureAuthenticated, ensureBotOwner, (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { filename } = req.params;
        
        if (filename.includes('..') || filename.includes('/')) return res.status(403).json({ error: 'Invalid filename' });

        const logPath = path.join(__dirname, '..', 'logs', filename);
        if (!fs.existsSync(logPath)) {
            return res.status(404).json({ success: false, message: 'Log not found' });
        }
        
        const content = fs.readFileSync(logPath, 'utf8');
        res.json({ success: true, filename, content });
    } catch (error) {
        console.error('Error fetching log file:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
