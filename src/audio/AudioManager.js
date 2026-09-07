import { AudioSession } from './AudioSession.js';
import { logger } from '../utils/logger.js';
import { attachSessionUI } from '../utils/attachSessionUI.js';

/**
 * Owns every AudioSession, keyed by guild ID.
 *
 * Design note: Discord only allows one voice connection per guild at a time,
 * so the natural key is guildId, not guildId+channelId — but each guild's
 * session is still fully independent of every other guild's session
 * (own connection, station, volume, pause state). Two different servers can
 * play two completely different radio stations at the same time with zero
 * shared state.
 */
class AudioManagerImpl {
  constructor() {
    /** @type {Map<string, AudioSession>} */
    this.sessions = new Map();
  }

  get(guildId) {
    return this.sessions.get(guildId) || null;
  }

  has(guildId) {
    return this.sessions.has(guildId);
  }

  /**
   * Gets the existing session for this guild, or creates one connected to
   * `voiceChannel` if none exists yet.
   */
  getOrCreate({ guild, voiceChannel, textChannel }) {
    let session = this.sessions.get(guild.id);
    if (session) return session;

    session = new AudioSession({ guild, voiceChannel, textChannel });

    session.once('destroyed', () => {
      this.sessions.delete(guild.id);
      logger.info('Session removed from manager', { guildId: guild.id });
    });

    attachSessionUI(session);

    this.sessions.set(guild.id, session);
    logger.info('Session created', { guildId: guild.id, voiceChannelId: voiceChannel.id });
    return session;
  }

  destroy(guildId, reason) {
    const session = this.sessions.get(guildId);
    session?.destroy(reason);
  }

  destroyAll(reason = 'shutdown') {
    for (const session of this.sessions.values()) session.destroy(reason);
  }
}

export const AudioManager = new AudioManagerImpl();
