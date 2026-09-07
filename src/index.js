import dns from 'node:dns';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadCommands } from './commandLoader.js';
import { handleRadioSelect } from './interactions/radioSelectHandler.js';
import { handleButton } from './interactions/buttonHandler.js';
import { AudioManager } from './audio/AudioManager.js';
import { GuildSettingsRepo } from './database/db.js'; // importing this also ensures schema exists on boot
import './radio/RadioStationManager.js'; // loads stations.yaml on boot

// Many VPS/Docker hosts advertise IPv6 that doesn't actually route anywhere.
// Since Node 18, dns.lookup() tries results in the order they arrive, which
// often means IPv6 first — if that IPv6 path is dead, voice's UDP handshake
// just hangs until timeout instead of falling back to IPv4 quickly. Forcing
// ipv4first avoids that class of "Ready never happens" failures entirely.
dns.setDefaultResultOrder('ipv4first');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

const commands = await loadCommands();

client.once('ready', () => {
  logger.info('Bot is online', { tag: client.user.tag, guilds: client.guilds.cache.size });
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'radio:select') {
      await handleRadioSelect(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ctrl:')) {
      await handleButton(interaction);
      return;
    }
  } catch (err) {
    // A single failed interaction must never take down the whole process.
    logger.error('Unhandled interaction error', {
      customId: interaction.customId,
      command: interaction.commandName,
      error: err.stack || err.message,
    });

    const payload = { content: '❌ Произошла непредвиденная ошибка при обработке команды.', ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch {
      // Interaction may have already expired — nothing more we can do.
    }
  }
});

// If a user leaves the bot alone in a voice channel, or the bot is kicked
// from voice externally, make sure we clean up the session rather than
// leaking a dangling connection.
client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = oldState.guild.id;
  const session = AudioManager.get(guildId);
  if (!session) return;

  const botIsInChannel = session.voiceChannel;
  const membersLeft = botIsInChannel.members.filter((m) => !m.user.bot);
  if (membersLeft.size === 0 && !GuildSettingsRepo.isAlwaysOn(guildId)) {
    logger.info('Voice channel empty, leaving', { guildId });
    session.destroy('channel-empty');
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.stack || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.stack || err.message });
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  logger.info('Shutting down, destroying all audio sessions');
  AudioManager.destroyAll('process-shutdown');
  client.destroy();
  process.exit(0);
}

client.login(env.discordToken);
