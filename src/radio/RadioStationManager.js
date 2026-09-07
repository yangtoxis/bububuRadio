import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIONS_PATH = path.join(__dirname, '..', 'config', 'stations.yaml');

/**
 * Single source of truth for the radio station list. Users never write to
 * this — it's owner-controlled config, loaded once at startup.
 * (Swap this for a DB-backed repo later without touching call sites if the
 * list needs to be edited without a redeploy.)
 */
class RadioStationManagerImpl {
  constructor() {
    this.stations = [];
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(STATIONS_PATH, 'utf8');
      const parsed = yaml.load(raw);
      this.stations = parsed?.stations || [];
      logger.info('Loaded radio stations', { count: this.stations.length });
    } catch (err) {
      logger.error('Failed to load stations.yaml', { error: err.message });
      this.stations = [];
    }
  }

  getAll() {
    return this.stations;
  }

  getById(id) {
    return this.stations.find((s) => s.id === id) || null;
  }
}

export const RadioStationManager = new RadioStationManagerImpl();
