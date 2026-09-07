import { PermissionsBitField } from 'discord.js';
import { GuildSettingsRepo } from '../database/db.js';

/**
 * Radio control (play/stop/leave/station picking/volume/sleep/24-7) is
 * restricted to a per-guild DJ role once the server owner sets one via
 * /dj-role. Until they do, control stays open to everyone — otherwise
 * turning this feature on would silently lock owners out of their own bot.
 * Server managers can always control the bot regardless of the DJ role, so
 * nobody gets locked out by a misconfigured/deleted role.
 */
export function isDJ(interaction) {
  const djRoleId = GuildSettingsRepo.get(interaction.guild.id)?.dj_role_id;
  if (!djRoleId) return true;
  if (interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
  return interaction.member.roles.cache.has(djRoleId);
}

export function requireDJ(interaction) {
  if (isDJ(interaction)) return { ok: true };
  return { ok: false, message: '❌ Управлять радио может только роль DJ на этом сервере.' };
}
