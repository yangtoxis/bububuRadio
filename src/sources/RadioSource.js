import { spawn } from 'node:child_process';
import { logger } from '../utils/logger.js';

// Deliberately not ffmpeg-static: its bundled binary is statically linked
// against glibc, and static glibc binaries segfault resolving DNS for real
// stream hosts (see Dockerfile). The apt-installed 'ffmpeg' on PATH doesn't
// have that problem.
const ffmpegPath = 'ffmpeg';

/**
 * Represents one fixed internet radio stream, resolved from the
 * owner-controlled stations.yaml. Never queued, has no duration — it just
 * keeps playing until replaced (a different station selected) or stopped.
 *
 * ffmpeg's own -reconnect flags absorb transient network blips; if the
 * process dies outright, AudioSession restarts it from scratch with backoff.
 */
export class RadioSource {
  constructor(station) {
    this.stationId = station.id;
    this.title = station.name;
    this.description = station.description;
    this.url = station.url;
    this.thumbnail = station.icon || null;
    this._ffmpegProcess = null;
  }

  async createStream() {
    const ffmpeg = spawn(
      ffmpegPath,
      [
        '-reconnect', '1',
        '-reconnect_at_eof', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-rw_timeout', '15000000', // 15s in microseconds
        '-i', this.url,
        '-analyzeduration', '0',
        '-loglevel', 'error',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    this._ffmpegProcess = ffmpeg;

    ffmpeg.stderr.on('data', (chunk) => {
      logger.warn('ffmpeg stderr (radio)', { station: this.stationId, message: chunk.toString().slice(0, 300) });
    });
    ffmpeg.on('error', (err) => {
      logger.error('ffmpeg process error (radio)', { station: this.stationId, error: err.message });
    });
    ffmpeg.on('close', (code, signal) => {
      // A close with a non-zero code right after spawn almost always means
      // the stream URL is unreachable/invalid/blocked — surfaced here since
      // otherwise it's invisible until AudioSession's Idle handler reacts.
      if (code !== 0 && code !== null) {
        logger.warn('ffmpeg exited (radio)', { station: this.stationId, code, signal });
      }
    });

    return ffmpeg.stdout;
  }

  async destroy() {
    if (this._ffmpegProcess && !this._ffmpegProcess.killed) {
      this._ffmpegProcess.kill('SIGKILL');
    }
  }
}
