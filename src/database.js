import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Crea o reutiliza la base de datos del bot.
 * @param {string} databasePath
 */
export function initialiseDatabase(databasePath) {
  ensureDirectory(path.dirname(databasePath));
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS inactivity_periods (
      user_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      role_snapshot TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tracked_roles (
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS role_statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      inactive_count INTEGER NOT NULL,
      active_count INTEGER NOT NULL,
      captured_at INTEGER NOT NULL
    );
  `);
  return db;
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
