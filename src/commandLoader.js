import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, 'commands');

export async function loadCommands() {
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.js'));
  const commands = new Map();

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(COMMANDS_DIR, file)).href);
    if (!mod.data || !mod.execute) {
      console.warn(`[commandLoader] Skipping ${file}: missing "data" or "execute" export`);
      continue;
    }
    commands.set(mod.data.name, mod);
  }

  return commands;
}
