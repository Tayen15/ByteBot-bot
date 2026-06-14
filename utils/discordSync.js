const { PermissionsBitField } = require('discord.js');

const syncUserGuilds = async (prisma, profile, userId) => {
    if (!profile.guilds || !Array.isArray(profile.guilds)) return;

    for (const guild of profile.guilds) {
        try {
            const isOwner = guild.owner === true;
            // Use PermissionsBitField instead of hardcoded hex values 0x8 (Administrator) and 0x20 (ManageGuild)
            const permissions = BigInt(guild.permissions);
            const isAdmin = (permissions & PermissionsBitField.Flags.Administrator) === PermissionsBitField.Flags.Administrator || 
                            (permissions & PermissionsBitField.Flags.ManageGuild) === PermissionsBitField.Flags.ManageGuild || 
                            isOwner;

            let dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) {
                dbGuild = await prisma.guild.create({
                    data: {
                        guildId: guild.id,
                        name: guild.name,
                        icon: guild.icon,
                        ownerId: isOwner ? profile.id : ''
                    }
                });
            } else {
                dbGuild = await prisma.guild.update({
                    where: { guildId: guild.id },
                    data: {
                        name: guild.name,
                        icon: guild.icon,
                        ownerId: isOwner ? profile.id : dbGuild.ownerId
                    }
                });
            }

            const key = { userId_guildId: { userId, guildId: dbGuild.id } };
            const existingMember = await prisma.guildMember.findUnique({ where: key });
            if (!existingMember) {
                await prisma.guildMember.create({
                    data: { userId, guildId: dbGuild.id, isAdmin, isOwner }
                });
            } else if (existingMember.isAdmin !== isAdmin || existingMember.isOwner !== isOwner) {
                await prisma.guildMember.update({ where: key, data: { isAdmin, isOwner } });
            }
        } catch (err) {
            console.error(`[DiscordSync] Error syncing guild ${guild.id}:`, err.message);
        }
    }
};

module.exports = { syncUserGuilds };
