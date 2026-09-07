import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ListeningStatsRepo } from '../database/db.js';

const COLOR = 0x5865f2;
const MEDALS = ['🥇', '🥈', '🥉'];

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин`;
  return '<1 мин';
}

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Топ-10 слушателей радио на этом сервере');

export async function execute(interaction) {
  const top = ListeningStatsRepo.getTop(interaction.guild.id, 10);

  if (!top.length) {
    return interaction.reply({ content: 'ℹ️ Пока никто не слушал радио на этом сервере.', ephemeral: true });
  }

  const lines = top.map((row, i) => {
    const rank = MEDALS[i] || `${i + 1}.`;
    return `${rank} <@${row.user_id}> — **${formatDuration(row.seconds_listened)}**`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🏆 Топ слушателей радио')
    .setDescription(lines.join('\n'));

  return interaction.reply({ embeds: [embed] });
}
