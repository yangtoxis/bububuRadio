import { SlashCommandBuilder } from 'discord.js';
import { requireActiveSession } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';

export const data = new SlashCommandBuilder().setName('leave').setDescription('Отключить бота от голосового канала');

export async function execute(interaction) {
  const check = requireActiveSession(interaction);
  if (!check.ok) return interaction.reply({ content: check.message, ephemeral: true });

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  check.session.destroy('user-requested');
  return interaction.reply({ content: '👋 Отключился от голосового канала.', ephemeral: true });
}
