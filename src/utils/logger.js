import winston from 'winston';
import { env } from '../config/env.js';

const SECRET_KEYS = ['token', 'secret', 'clientsecret', 'client_secret', 'password'];

// Best-effort redaction so secrets never end up in logs even if accidentally
// passed inside a metadata object.
function redact(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const clone = Array.isArray(meta) ? [...meta] : { ...meta };
  for (const key of Object.keys(clone)) {
    if (SECRET_KEYS.some((k) => key.toLowerCase().includes(k))) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = redact(clone[key]);
    }
  }
  return clone;
}

const baseLogger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const safeMeta = redact(meta);
      const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
      return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Creates a child logger pre-tagged with session context (guild/channel),
 * so every log line answers "who / what source / where / when" per the spec.
 */
export function createSessionLogger(context = {}) {
  return {
    info: (message, meta = {}) => baseLogger.info(message, { ...context, ...meta }),
    warn: (message, meta = {}) => baseLogger.warn(message, { ...context, ...meta }),
    error: (message, meta = {}) => baseLogger.error(message, { ...context, ...meta }),
    debug: (message, meta = {}) => baseLogger.debug(message, { ...context, ...meta }),
  };
}

export const logger = createSessionLogger();
