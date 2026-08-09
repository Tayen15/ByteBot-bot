const prisma = require('./database');

/**
 * Save lofi session to database
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Voice channel ID
 */
async function saveLofiSession(guildId, channelId) {
     try {
          // First, ensure guild exists in database
          let guild = await prisma.guild.findUnique({
               where: { guildId }
          });

          if (!guild) {
               // Create guild if doesn't exist
               guild = await prisma.guild.create({
                    data: {
                         guildId,
                         name: 'Unknown',
                         ownerId: '0'
                    }
               });
          }

          // Remove any existing active sessions for this guild to keep database clean
          await prisma.lofiSession.deleteMany({
               where: {
                    guildId: guild.id
               }
          });

          // Create new active session
          await prisma.lofiSession.create({
               data: {
                    guildId: guild.id,
                    channelId
               }
          });

          console.log(`[LofiStorage] Session saved for guild ${guildId}`);
     } catch (error) {
          console.error('[LofiStorage] Error saving session:', error);
     }
}

/**
 * Remove lofi session from database
 * @param {string} guildId - Guild ID
 */
async function removeLofiSession(guildId) {
     try {
          const guild = await prisma.guild.findUnique({
               where: { guildId }
          });

          if (!guild) return;

          // Delete all sessions for this guild
          await prisma.lofiSession.deleteMany({
               where: {
                    guildId: guild.id
               }
          });

          console.log(`[LofiStorage] Session removed for guild ${guildId}`);
     } catch (error) {
          console.error('[LofiStorage] Error removing session:', error);
     }
}

/**
 * Get all active lofi sessions
 * @returns {Promise<Array>} Array of active lofi sessions with guild info
 */
async function getLofiSessions() {
     try {
          const sessions = await prisma.lofiSession.findMany({
               where: {
                    isActive: true
               },
               include: {
                    guild: true
               }
          });

          // Convert to old format for backward compatibility
          return sessions.map(session => ({
               guildId: session.guild.guildId,
               channelId: session.channelId,
               startedAt: session.startedAt
          }));
     } catch (error) {
          console.error('[LofiStorage] Error getting sessions:', error);
          return [];
     }
}

/**
 * Get active session for a specific guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object|null>} Active session or null
 */
async function getGuildLofiSession(guildId) {
     try {
          const guild = await prisma.guild.findUnique({
               where: { guildId }
          });

          if (!guild) return null;

          const session = await prisma.lofiSession.findFirst({
               where: {
                    guildId: guild.id,
                    isActive: true
               }
          });

          return session;
     } catch (error) {
          console.error('[LofiStorage] Error getting guild session:', error);
          return null;
     }
}

module.exports = {
     saveLofiSession,
     removeLofiSession,
     getLofiSessions,
     getGuildLofiSession
};
