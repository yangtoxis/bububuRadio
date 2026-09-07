import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { requireActiveSession } from '../utils/voiceGuards.js';
import { requireDJ } from '../utils/djGuard.js';
import { buildPlayerPayload } from '../utils/nowPlayingMessage.js';
import { radioPickerEmbed } from '../utils/embeds.js';
import { RadioStationManager } from '../radio/RadioStationManager.js';

export async function handleButton(interaction) {
  const [, action, arg] = interaction.customId.split(':'); // 'ctrl:playpause' etc.

  const check = requireActiveSession(interaction);
  if (!check.ok) {
    return interaction.reply({ content: check.message, ephemeral: true });
  }

  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const session = check.session;

  switch (action) {
    case 'playpause': {
      if (!session.station) {
        return interaction.reply({ content: '❌ Сейчас не выбрана ни одна станция.', ephemeral: true });
      }
      if (session.isPaused) session.resume();
      else session.pause();
      return interaction.update(buildPlayerPayload(session));
    }

    case 'stop': {
      session.stop();
      return interaction.update(buildPlayerPayload(session));
    }

    case 'radio': {
      const stations = RadioStationManager.getAll();
      const select = new StringSelectMenuBuilder()
        .setCustomId('radio:select')
        .setPlaceholder('Выберите радиостанцию')
        .addOptions(stations.map((s) => ({ label: s.name, value: s.id, description: s.description?.slice(0, 100) })));
      const row = new ActionRowBuilder().addComponents(select);
      return interaction.reply({ embeds: [radioPickerEmbed()], components: [row], ephemeral: true });
    }

    case 'volume': {
      const delta = arg === 'up' ? 10 : -10;
      const newVolume = Math.min(100, Math.max(0, Math.round(session.volume * 100) + delta));
      session.setVolume(newVolume);
      return interaction.update(buildPlayerPayload(session));
    }

    case 'leave': {
      session.destroy('user-requested-button');
      return interaction.reply({ content: '👋 Отключился.', ephemeral: true });
    }

    default:
      return interaction.reply({ content: '❌ Эта функция недоступна.', ephemeral: true });
  }
}
