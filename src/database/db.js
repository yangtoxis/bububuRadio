import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const dbDir = path.dirname(env.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(env.db.path);
db.pragma('journal_mode = WAL');

// Only durable, cross-restart data lives here.
// Active VoiceConnection / AudioPlayer / in-memory queue state is NEVER persisted —
// on restart, sessions are simply gone and users re-issue /play or /radio.
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    default_volume INTEGER DEFAULT 70,
    dj_role_id TEXT,
    always_on INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    preferred_volume INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS listening_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    seconds_listened INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
`);

// `always_on` was added after the table already existed for some deployments —
// CREATE TABLE IF NOT EXISTS above is a no-op there, so add the column by hand.
const guildSettingsColumns = db.prepare('PRAGMA table_info(guild_settings)').all();
if (!guildSettingsColumns.some((c) => c.name === 'always_on')) {
  db.exec('ALTER TABLE guild_settings ADD COLUMN always_on INTEGER DEFAULT 0');
}

logger.info('Database initialized', { path: env.db.path });

export const GuildSettingsRepo = {
  get(guildId) {
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  },
  upsertVolume(guildId, volume) {
    db.prepare(
      `INSERT INTO guild_settings (guild_id, default_volume, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(guild_id) DO UPDATE SET default_volume = excluded.default_volume, updated_at = CURRENT_TIMESTAMP`
    ).run(guildId, volume);
  },
  isAlwaysOn(guildId) {
    return Boolean(db.prepare('SELECT always_on FROM guild_settings WHERE guild_id = ?').get(guildId)?.always_on);
  },
  setAlwaysOn(guildId, enabled) {
    db.prepare(
      `INSERT INTO guild_settings (guild_id, always_on, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(guild_id) DO UPDATE SET always_on = excluded.always_on, updated_at = CURRENT_TIMESTAMP`
    ).run(guildId, enabled ? 1 : 0);
  },
  setDjRole(guildId, roleId) {
    db.prepare(
      `INSERT INTO guild_settings (guild_id, dj_role_id, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(guild_id) DO UPDATE SET dj_role_id = excluded.dj_role_id, updated_at = CURRENT_TIMESTAMP`
    ).run(guildId, roleId);
  },
};

export const UserSettingsRepo = {
  get(userId) {
    return db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  },
};

export const ListeningStatsRepo = {
  addSeconds(guildId, userId, seconds) {
    db.prepare(
      `INSERT INTO listening_stats (guild_id, user_id, seconds_listened, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET
         seconds_listened = seconds_listened + excluded.seconds_listened,
         updated_at = CURRENT_TIMESTAMP`
    ).run(guildId, userId, seconds);
  },
  getTop(guildId, limit = 10) {
    return db
      .prepare(
        `SELECT user_id, seconds_listened FROM listening_stats
         WHERE guild_id = ? ORDER BY seconds_listened DESC LIMIT ?`
      )
      .all(guildId, limit);
  },
};
