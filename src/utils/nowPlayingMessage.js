import { MessageFlags } from 'discord.js';
import { nowPlayingEmbed, trackAnnouncementEmbed } from './embeds.js';
import { buildControlRows, buildTrackLinkRow } from './controls.js';
import { logger } from '../utils/logger.js';

/**
 * Builds the full control panel (embed + playback buttons) as a plain
 * payload. Callers send/update this ephemerally so only the person who
 * actually has DJ control sees it — everyone else in the channel has no use
 * for buttons they aren't allowed to press.
 */
export function buildPlayerPayload(session) {
  return {
    embeds: [nowPlayingEmbed(session)],
    components: buildControlRows(session),
  };
}

/**
 * Posts a public, channel-wide "now playing" announcement whenever the
 * track changes, with link buttons to look the track up elsewhere. Deletes
 * the previous announcement first so the channel only ever shows the
 * current track, not a growing history.
 */
export async function postTrackAnnouncement(session, title) {
  if (session.trackAnnouncementMessage) {
    try {
      await session.trackAnnouncementMessage.delete();
    } catch {
      // Already deleted/inaccessible — nothing to clean up.
    }
    session.trackAnnouncementMessage = null;
  }

  // Track changes happen every few minutes, all day — a push/sound ping for
  // each one would be noise, not signal. SuppressNotifications still posts
  // the message normally, it just skips the notification.
  const payload = {
    embeds: [trackAnnouncementEmbed(session, title)],
    components: [buildTrackLinkRow(title)],
    flags: MessageFlags.SuppressNotifications,
  };

  try {
    session.trackAnnouncementMessage = await session.textChannel.send(payload);
  } catch (err) {
    logger.error('Failed to post track announcement', { error: err.message });
  }
  return session.trackAnnouncementMessage;
}
