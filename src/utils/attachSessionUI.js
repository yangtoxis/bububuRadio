import { postTrackAnnouncement } from './nowPlayingMessage.js';
import { errorEmbed } from './embeds.js';
import { logger } from './logger.js';

/**
 * Wires a freshly-created AudioSession to its channel-wide side effects.
 * Called exactly once per session (from AudioManager.getOrCreate), so we
 * never accumulate duplicate listeners across repeated /play or button calls.
 *
 * The full control panel is deliberately NOT posted here — it's only ever
 * shown ephemerally to whoever ran the command that produced it (see the
 * command handlers), since only DJ-role members can use its buttons anyway.
 */
export function attachSessionUI(session) {
  // A track change gets a brand-new public announcement (old one deleted)
  // rather than an in-place edit, so the new song is visible as a fresh post.
  session.on('trackChange', (title) => postTrackAnnouncement(session, title));

  session.on('error', (err) => {
    session.textChannel
      .send({ embeds: [errorEmbed('Ошибка воспроизведения', err.message || 'Неизвестная ошибка.')] })
      .catch((e) => logger.error('Failed to send error message to channel', { error: e.message }));
  });
}
