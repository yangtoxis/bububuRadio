import { RadioStationManager } from '../radio/RadioStationManager.js';
import { RadioSource } from '../sources/RadioSource.js';
import { AudioManager } from '../audio/AudioManager.js';
import { checkVoicePreconditions } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';
import { buildPlayerPayload } from '../utils/nowPlayingMessage.js';
import { errorEmbed } from '../utils/embeds.js';

export async function handleRadioSelect(interaction) {
  const precheck = checkVoicePreconditions(interaction);
  if (!precheck.ok) {
    return interaction.reply({ content: precheck.message, ephemeral: true });
  }

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const stationId = interaction.values[0];
  const station = RadioStationManager.getById(stationId);
  if (!station) {
    return interaction.reply({
      embeds: [errorEmbed('Станция не найдена', 'Эта радиостанция больше не существует в конфигурации.')],
      ephemeral: true,
    });
  }

  const session = AudioManager.getOrCreate({
    guild: interaction.guild,
    voiceChannel: precheck.voiceChannel,
    textChannel: interaction.channel,
  });

  // A new station selection always replaces whatever is currently playing.
  const source = new RadioSource(station);
  await session.playStation(source);

  // Morphs the ephemeral picker message into the player panel — same
  // message, now showing the station that was just picked.
  await interaction.update(buildPlayerPayload(session));
}
