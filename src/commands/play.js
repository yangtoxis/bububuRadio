import { SlashCommandBuilder } from 'discord.js';
import { RadioStationManager } from '../radio/RadioStationManager.js';
import { RadioSource } from '../sources/RadioSource.js';
import { AudioManager } from '../audio/AudioManager.js';
import { checkVoicePreconditions } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';
import { buildPlayerPayload } from '../utils/nowPlayingMessage.js';
import { errorEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder().setName('play').setDescription('Начать воспроизведение радио');

export async function execute(interaction) {
  const precheck = checkVoicePreconditions(interaction);
  if (!precheck.ok) {
    return interaction.reply({ content: precheck.message, ephemeral: true });
  }

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const session = AudioManager.getOrCreate({
    guild: interaction.guild,
    voiceChannel: precheck.voiceChannel,
    textChannel: interaction.channel,
  });

  if (session.station && session.isPaused) {
    session.resume();
    return interaction.reply({ ...buildPlayerPayload(session), ephemeral: true });
  }

  if (session.station) {
    return interaction.reply({
      content: 'ℹ️ Радио уже играет. Используйте `/radio`, чтобы сменить станцию.',
      ephemeral: true,
    });
  }

  const stations = RadioStationManager.getAll();
  if (!stations.length) {
    return interaction.reply({
      embeds: [errorEmbed('Радиостанции недоступны', 'Список радиостанций пуст или не был загружен.')],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  const defaultStation = stations[0];
  const source = new RadioSource(defaultStation);
  await session.playStation(source);
  return interaction.editReply(buildPlayerPayload(session));
}
