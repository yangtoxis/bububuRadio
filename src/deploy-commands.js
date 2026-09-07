import { REST, Routes } from 'discord.js';
import { env } from './config/env.js';
import { loadCommands } from './commandLoader.js';

async function main() {
  const commands = await loadCommands();
  const body = [...commands.values()].map((c) => c.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(env.discordToken);

  const route = env.guildId
    ? Routes.applicationGuildCommands(env.clientId, env.guildId) // instant update, dev use
    : Routes.applicationCommands(env.clientId); // global, up to ~1h propagation

  await rest.put(route, { body });
  console.log(
    `Deployed ${body.length} slash commands ${env.guildId ? `to guild ${env.guildId}` : 'globally'}.`
  );
}

main().catch((err) => {
  console.error('Failed to deploy commands:', err);
  process.exit(1);
});
