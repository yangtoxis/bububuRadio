import { EmbedBuilder } from 'discord.js';

const COLOR = 0x5865f2;
const COLOR_ERROR = 0xed4245;

export function errorEmbed(title, description) {
  return new EmbedBuilder().setColor(COLOR_ERROR).setTitle(`❌ ${title}`).setDescription(description);
}

export function nowPlayingEmbed(session) {
  const station = session.station;

  if (!station) {
    return new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('📻 Ничего не играет')
      .setDescription('Используйте `/radio`, чтобы выбрать станцию.');
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`📻 ${station.title}`)
    .setDescription(station.description || '')
    .addFields(
      { name: 'Сейчас играет', value: session.currentTrackTitle || '_неизвестно_' },
      { name: 'Громкость', value: `${Math.round(session.volume * 100)}%`, inline: true },
      { name: 'Статус', value: session.isPaused ? '⏸ На паузе' : '▶️ Играет', inline: true }
    );

  if (station.thumbnail) embed.setThumbnail(station.thumbnail);

  return embed;
}

/** Compact public announcement posted to the channel whenever the track changes. */
export function trackAnnouncementEmbed(session, title) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🎵 Сейчас играет')
    .setDescription(`**${title}**`)
    .setFooter({ text: session.station?.title || 'Radio' });

  if (session.station?.thumbnail) embed.setThumbnail(session.station.thumbnail);

  return embed;
}

export function radioPickerEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('📻 Радио')
    .setDescription('Выберите радиостанцию из списка ниже:');
}
