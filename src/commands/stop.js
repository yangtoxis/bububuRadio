import { SlashCommandBuilder } from 'discord.js';
import { requireActiveSession } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';
import { buildPlayerPayload } from '../utils/nowPlayingMessage.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Поставить радио на паузу (бот остаётся в канале)');

export async function execute(interaction) {
  const check = requireActiveSession(interaction);
  if (!check.ok) return interaction.reply({ content: check.message, ephemeral: true });

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  if (!check.session.station) {
    return interaction.reply({ content: '❌ Сейчас не выбрана ни одна станция.', ephemeral: true });
  }

  check.session.pause();
  return interaction.reply({ ...buildPlayerPayload(check.session), ephemeral: true });
}
