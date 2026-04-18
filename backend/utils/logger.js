/**
 * logger.js
 * Lightweight structured logger for the Water Tank Monitoring backend.
 * Writes timestamped, levelled messages to stdout/stderr.
 * No external dependencies — pure Node.js.
 */

'use strict';

// ANSI colour codes for terminal output
const COLOURS = {
  RESET:  '\x1b[0m',
  BOLD:   '\x1b[1m',
  INFO:   '\x1b[36m',   // Cyan
  WARN:   '\x1b[33m',   // Yellow
  ERROR:  '\x1b[31m',   // Red
  PUMP:   '\x1b[35m',   // Magenta  — dedicated pump-change channel
  SUCCESS:'\x1b[32m',   // Green
  API:    '\x1b[34m',   // Blue
};

/**
 * Build an ISO-8601 timestamp string (local clock, compact form).
 * @returns {string} e.g. "2025-04-15 10:30:05.123"
 */
function timestamp() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.` +
    `${String(d.getMilliseconds()).padStart(3, '0')}`
  );
}

/**
 * Core print function.
 * @param {string} level   - Log level label
 * @param {string} colour  - ANSI colour code
 * @param {string} message - Human-readable message
 * @param {object} [meta]  - Optional structured metadata object
 * @param {boolean} [isError] - Route to stderr when true
 */
function print(level, colour, message, meta, isError = false) {
  const ts     = timestamp();
  const prefix = `${colour}${COLOURS.BOLD}[${level.padEnd(7)}]${COLOURS.RESET}`;
  const line   = `${COLOURS.RESET}${ts} ${prefix} ${message}`;

  const output = meta
    ? `${line}  ${COLOURS.RESET}${JSON.stringify(meta)}`
    : line;

  if (isError) {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const logger = {
  /**
   * General informational message.
   * @param {string} message
   * @param {object} [meta]
   */
  info(message, meta) {
    print('INFO', COLOURS.INFO, message, meta);
  },

  /**
   * Non-critical warning.
   * @param {string} message
   * @param {object} [meta]
   */
  warn(message, meta) {
    print('WARN', COLOURS.WARN, message, meta);
  },

  /**
   * Error condition — routed to stderr.
   * @param {string} message
   * @param {Error|object} [errOrMeta]
   */
  error(message, errOrMeta) {
    let meta;
    if (errOrMeta instanceof Error) {
      meta = { error: errOrMeta.message, stack: errOrMeta.stack };
    } else {
      meta = errOrMeta;
    }
    print('ERROR', COLOURS.ERROR, message, meta, true);
  },

  /**
   * Dedicated channel for pump state changes.
   * @param {string} tankId
   * @param {string} prevState  - Previous pump state ("ON" | "OFF")
   * @param {string} nextState  - New pump state
   * @param {string} reason     - Trigger reason (e.g. "AUTO:low-level", "MANUAL:api")
   */
  pump(tankId, prevState, nextState, reason) {
    const arrow   = prevState === nextState ? '══' : '⟹';
    const message = `Pump [${tankId}] ${prevState} ${arrow} ${nextState}`;
    print('PUMP', COLOURS.PUMP, message, { reason });
  },

  /**
   * Log an incoming HTTP API call — method, route, optional body summary.
   * @param {string} method  - HTTP verb
   * @param {string} route   - Request URL/path
   * @param {object} [meta]  - Any extra context (query, body excerpt, etc.)
   */
  api(method, route, meta) {
    const message = `${method.padEnd(6)} ${route}`;
    print('API', COLOURS.API, message, meta);
  },

  /**
   * Startup / success messages.
   * @param {string} message
   * @param {object} [meta]
   */
  success(message, meta) {
    print('OK', COLOURS.SUCCESS, message, meta);
  },
};

module.exports = logger;
