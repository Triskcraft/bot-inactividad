import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

defineConfigDefaults();

function defineConfigDefaults() {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
}

/**
 * @typedef {Object} BotConfig
 * @property {string} token
 * @property {string} clientId
 * @property {string} guildId
 * @property {string} inactivityChannelId
 * @property {string} adminLogChannelId
 * @property {string} databasePath
 * @property {number} reminderIntervalMinutes
 */

/**
 * Loads bot configuration from environment variables.
 * @returns {BotConfig}
 */
export function loadConfig() {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'DISCORD_INACTIVITY_CHANNEL_ID',
    'DISCORD_ADMIN_LOG_CHANNEL_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    inactivityChannelId: process.env.DISCORD_INACTIVITY_CHANNEL_ID,
    adminLogChannelId: process.env.DISCORD_ADMIN_LOG_CHANNEL_ID,
    databasePath: process.env.DATABASE_PATH ?? path.resolve(__dirname, '..', 'data', 'inactividad.db'),
    reminderIntervalMinutes: Number.parseInt(process.env.REMINDER_INTERVAL_MINUTES ?? '5', 10),
  };
}
