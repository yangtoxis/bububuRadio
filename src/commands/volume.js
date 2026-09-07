import { SlashCommandBuilder } from 'discord.js';
import { requireActiveSession } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';
import { buildPlayerPayload } from '../utils/nowPlayingMessage.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Изменить громкость радио')
  .addIntegerOption((opt) =>
    opt.setName('уровень').setDescription('Громкость от 0 до 100').setRequired(true).setMinValue(0).setMaxValue(100)
  );

export async function execute(interaction) {
  const check = requireActiveSession(interaction);
  if (!check.ok) return interaction.reply({ content: check.message, ephemeral: true });

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const level = interaction.options.getInteger('уровень');
  check.session.setVolume(level);
  return interaction.reply({ ...buildPlayerPayload(check.session), ephemeral: true });
}
