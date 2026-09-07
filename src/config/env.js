import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`[config] Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  discordToken: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: process.env.GUILD_ID || null, // optional: for fast per-guild command registration in dev

  db: {
    path: process.env.DB_PATH || './data/bot.sqlite',
  },

  defaults: {
    volume: Number(process.env.DEFAULT_VOLUME || 70),
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};
