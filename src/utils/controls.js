import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Uploaded once as application emojis (available in every guild the bot is
// in) via a one-off script — see the session notes. IDs are stable as long
// as these aren't deleted from the application's emoji list.
const SPOTIFY_EMOJI = { id: '1546642170868535348', name: 'spotify_icon' };
const YOUTUBE_EMOJI = { id: '1546642172357386251', name: 'youtube_icon' };
const YANDEX_MUSIC_EMOJI = { id: '1546642174324772864', name: 'yandexmusic_icon' };

/**
 * Link buttons to search for the currently announced track on other
 * platforms. These are plain URL buttons — Discord never routes them
 * through an interaction handler, so no permission check applies to them.
 */
export function buildTrackLinkRow(title) {
  const query = encodeURIComponent(title);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Spotify')
      .setEmoji(SPOTIFY_EMOJI)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://open.spotify.com/search/${query}`),
    new ButtonBuilder()
      .setLabel('YouTube')
      .setEmoji(YOUTUBE_EMOJI)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.youtube.com/results?search_query=${query}`),
    new ButtonBuilder()
      .setLabel('Яндекс.Музыка')
      .setEmoji(YANDEX_MUSIC_EMOJI)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://music.yandex.ru/search?text=${query}`)
  );
}

export function buildControlRows(session) {
  const hasStation = Boolean(session.station);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ctrl:playpause')
      .setEmoji(session.isPaused ? '▶️' : '⏸')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasStation),
    new ButtonBuilder().setCustomId('ctrl:stop').setEmoji('⏹').setStyle(ButtonStyle.Danger).setDisabled(!hasStation),
    new ButtonBuilder().setCustomId('ctrl:radio').setEmoji('📻').setLabel('Радио').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ctrl:volume:down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ctrl:volume:up').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ctrl:leave').setEmoji('👋').setLabel('Выйти').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}
