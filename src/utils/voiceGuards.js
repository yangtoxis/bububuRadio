import { PermissionsBitField } from 'discord.js';
import { AudioManager } from '../audio/AudioManager.js';

/**
 * Runs the common set of checks before doing anything voice-related.
 * Returns { ok: true, voiceChannel } or { ok: false, message } so commands
 * can just reply with `message` and stop, per the required error handling.
 */
export function checkVoicePreconditions(interaction) {
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    return { ok: false, message: '❌ Ты должен находиться в голосовом канале, чтобы использовать эту команду.' };
  }

  const permissions = voiceChannel.permissionsFor(interaction.client.user);
  if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
    return { ok: false, message: '❌ У меня нет прав на подключение к этому голосовому каналу.' };
  }
  if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
    return { ok: false, message: '❌ У меня нет прав говорить в этом голосовом канале.' };
  }

  const existingSession = AudioManager.get(interaction.guild.id);
  if (existingSession && existingSession.voiceChannel.id !== voiceChannel.id) {
    return {
      ok: false,
      message: `❌ Я уже подключён к другому голосовому каналу (${existingSession.voiceChannel}) на этом сервере.`,
    };
  }

  return { ok: true, voiceChannel };
}

export function requireActiveSession(interaction) {
  const session = AudioManager.get(interaction.guild.id);
  if (!session) {
    return { ok: false, message: '❌ Сейчас ничего не воспроизводится.' };
  }
  return { ok: true, session };
}
