import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { RadioStationManager } from '../radio/RadioStationManager.js';
import { requireDJ } from '../utils/djGuard.js';
import { radioPickerEmbed, errorEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder().setName('radio').setDescription('Открыть выбор радиостанции');

export async function execute(interaction) {
  const dj = requireDJ(interaction);
  if (!dj.ok) return interaction.reply({ content: dj.message, ephemeral: true });

  const stations = RadioStationManager.getAll();

  if (!stations.length) {
    return interaction.reply({
      embeds: [errorEmbed('Радиостанции недоступны', 'Список радиостанций пуст или не был загружен.')],
      ephemeral: true,
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('radio:select')
    .setPlaceholder('Выберите радиостанцию')
    .addOptions(
      stations.map((s) => ({
        label: s.name,
        value: s.id,
        description: s.description?.slice(0, 100) || undefined,
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.reply({ embeds: [radioPickerEmbed()], components: [row], ephemeral: true });
}
