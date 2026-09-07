import { SlashCommandBuilder } from 'discord.js';
import { GuildSettingsRepo } from '../database/db.js';
import { requireDJ } from '../utils/djGuard.js';

export const data = new SlashCommandBuilder()
  .setName('247')
  .setDescription('Включить/выключить режим 24/7 (бот не выходит из пустого канала)');

export async function execute(interaction) {
  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const guildId = interaction.guild.id;
  const next = !GuildSettingsRepo.isAlwaysOn(guildId);
  GuildSettingsRepo.setAlwaysOn(guildId, next);

  return interaction.reply({
    content: next
      ? '🔁 Режим 24/7 включён — бот останется в канале, даже если он опустеет.'
      : '🔁 Режим 24/7 выключен — бот будет выходить из пустого канала.',
    ephemeral: true,
  });
}
