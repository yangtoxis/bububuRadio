import { SlashCommandBuilder } from 'discord.js';
import { requireActiveSession } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';

export const data = new SlashCommandBuilder()
  .setName('sleep')
  .setDescription('Выйти из канала через указанное время')
  .addIntegerOption((opt) =>
    opt
      .setName('минуты')
      .setDescription('Через сколько минут выйти (0 — отменить таймер)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(360)
  );

export async function execute(interaction) {
  const check = requireActiveSession(interaction);
  if (!check.ok) return interaction.reply({ content: check.message, ephemeral: true });

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const minutes = interaction.options.getInteger('минуты');
  const session = check.session;

  if (minutes === 0) {
    if (session.clearSleepTimer()) {
      return interaction.reply({ content: '⏰ Таймер сна отменён.', ephemeral: true });
    }
    return interaction.reply({ content: 'ℹ️ Таймер сна не был установлен.', ephemeral: true });
  }

  session.setSleepTimer(minutes);
  return interaction.reply({ content: `⏰ Бот выйдет из канала через ${minutes} мин.`, ephemeral: true });
}
