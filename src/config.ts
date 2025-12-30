import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';

try {
  process.loadEnvFile()
} catch {
  logger.error("No existe .env")
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

defineConfigDefaults();

function defineConfigDefaults() {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
}

export interface BotConfig {
  token: string,
  clientId: string,
  guildId: string,
  inactivityChannelId: string,
  adminLogChannelId: string,
  databasePath: string,
  reminderIntervalMinutes: number
}

/**
 * Loads bot configuration from environment variables.
 */
export function loadConfig() {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'DISCORD_INACTIVITY_CHANNEL_ID',
    'DISCORD_ADMIN_LOG_CHANNEL_ID',
    "API_PORT",
    'WHITELIST_ROUTE',
    'PLAYER_LIST_ROUTE',
    'DEPLOY_COMMAND'
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }

  const { API_PORT = "", WHITELIST_ROUTE = "", PLAYER_LIST_ROUTE = "", DEPLOY_COMMAND = false } = process.env

  return {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
    guildId: process.env.DISCORD_GUILD_ID!,
    inactivityChannelId: process.env.DISCORD_INACTIVITY_CHANNEL_ID!,
    adminLogChannelId: process.env.DISCORD_ADMIN_LOG_CHANNEL_ID!,
    databasePath: process.env.DATABASE_PATH ?? path.resolve(__dirname, '..', 'data', 'inactividad.db'),
    reminderIntervalMinutes: Number.parseInt(process.env.REMINDER_INTERVAL_MINUTES ?? '5', 10),
    API_PORT,
    WHITELIST_ROUTE,
    PLAYER_LIST_ROUTE,
    DEPLOY_COMMAND: DEPLOY_COMMAND === "true"
  };
}

export const envs = loadConfig()
