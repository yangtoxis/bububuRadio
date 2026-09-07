import http from 'node:http';
import https from 'node:https';
import { logger } from '../utils/logger.js';

const MAX_REDIRECTS = 5;
const RETRY_DELAY_MS = 5000;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Reads ICY (SHOUTcast/Icecast) in-stream metadata to get the currently
 * playing track title, over its own connection — ffmpeg's own connection
 * (used for audio in RadioSource) never asks for `Icy-MetaData: 1` and
 * discards it entirely, so there's no way to get the title through that
 * pipe. Not every stream supports this; if the server never sends an
 * `icy-metaint` header we just give up quietly and the caller keeps
 * showing the station's static title.
 */
export class IcyMetadataReader {
  constructor(url, onTitleChange) {
    this.onTitleChange = onTitleChange;
    this.lastTitle = null;
    this._stopped = false;
    this._request = null;
    this._connect(url, 0);
  }

  _connect(url, redirectCount) {
    if (this._stopped) return;

    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      { headers: { 'Icy-MetaData': '1', 'User-Agent': 'Mozilla/5.0 (compatible; discord-radio-bot)' } },
      (res) => this._onResponse(res, url, redirectCount)
    );
    req.on('error', () => this._scheduleReconnect(url, redirectCount));
    this._request = req;
  }

  _onResponse(res, url, redirectCount) {
    if (REDIRECT_CODES.has(res.statusCode) && res.headers.location && redirectCount < MAX_REDIRECTS) {
      res.resume();
      this._connect(new URL(res.headers.location, url).href, redirectCount + 1);
      return;
    }

    const metaInt = parseInt(res.headers['icy-metaint'], 10);
    if (!metaInt) {
      // Stream doesn't support ICY metadata — nothing more we can do.
      res.destroy();
      return;
    }

    let bytesUntilMeta = metaInt;
    let mode = 'audio'; // 'audio' | 'meta-length' | 'meta-data'
    let metaLength = 0;
    let metaBuffer = Buffer.alloc(0);

    res.on('data', (chunk) => {
      let offset = 0;
      while (offset < chunk.length) {
        if (mode === 'audio') {
          const take = Math.min(bytesUntilMeta, chunk.length - offset);
          offset += take;
          bytesUntilMeta -= take;
          if (bytesUntilMeta === 0) mode = 'meta-length';
        } else if (mode === 'meta-length') {
          metaLength = chunk[offset] * 16;
          offset += 1;
          metaBuffer = Buffer.alloc(0);
          if (metaLength > 0) {
            mode = 'meta-data';
          } else {
            mode = 'audio';
            bytesUntilMeta = metaInt;
          }
        } else {
          const remaining = metaLength - metaBuffer.length;
          const take = Math.min(remaining, chunk.length - offset);
          metaBuffer = Buffer.concat([metaBuffer, chunk.subarray(offset, offset + take)]);
          offset += take;
          if (metaBuffer.length >= metaLength) {
            this._handleMetadata(metaBuffer.toString('utf8'));
            mode = 'audio';
            bytesUntilMeta = metaInt;
          }
        }
      }
    });

    res.on('error', () => this._scheduleReconnect(url, redirectCount));
    res.on('close', () => this._scheduleReconnect(url, redirectCount));
  }

  _scheduleReconnect(url, redirectCount) {
    if (this._stopped) return;
    setTimeout(() => this._connect(url, redirectCount), RETRY_DELAY_MS);
  }

  _handleMetadata(raw) {
    const match = raw.match(/StreamTitle='([^']*)'/);
    if (!match) return;
    const title = match[1].trim();
    if (!title || title === this.lastTitle) return;
    this.lastTitle = title;
    try {
      this.onTitleChange(title);
    } catch (err) {
      logger.error('IcyMetadataReader onTitleChange callback failed', { error: err.message });
    }
  }

  stop() {
    this._stopped = true;
    this._request?.destroy();
  }
}
