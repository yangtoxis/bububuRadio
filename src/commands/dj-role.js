import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { GuildSettingsRepo } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('dj-role')
  .setDescription('Назначить роль DJ (только она сможет управлять радио)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addRoleOption((opt) =>
    opt.setName('роль').setDescription('Роль DJ (не указывайте, чтобы снять ограничение)').setRequired(false)
  );

export async function execute(interaction) {
  const role = interaction.options.getRole('роль');
  GuildSettingsRepo.setDjRole(interaction.guild.id, role?.id ?? null);

  return interaction.reply({
    content: role
      ? `🎚 Теперь управлять радио может только роль ${role}.`
      : '🎚 Ограничение по роли снято — управлять радио может любой.',
    ephemeral: true,
  });
}
