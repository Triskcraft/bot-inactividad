import { DateTime } from 'luxon';

/**
 * Gestiona los roles que los administradores desean monitorear.
 */
export class RoleService {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this.db = db;
    this.insertRole = db.prepare('INSERT OR IGNORE INTO tracked_roles (guild_id, role_id, created_at) VALUES (?, ?, ?)');
    this.deleteRole = db.prepare('DELETE FROM tracked_roles WHERE guild_id = ? AND role_id = ?');
    this.listRolesStmt = db.prepare('SELECT role_id FROM tracked_roles WHERE guild_id = ?');
    this.insertSnapshot = db.prepare(`
      INSERT INTO role_statistics (guild_id, role_id, inactive_count, active_count, captured_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.recentSnapshots = db.prepare(`
      SELECT role_id, inactive_count, active_count, captured_at
      FROM role_statistics
      WHERE guild_id = ? AND captured_at >= ?
      ORDER BY captured_at DESC
    `);
  }

  addRole(guildId, roleId) {
    this.insertRole.run(guildId, roleId, DateTime.utc().toSeconds());
  }

  removeRole(guildId, roleId) {
    this.deleteRole.run(guildId, roleId);
  }

  listRoles(guildId) {
    return this.listRolesStmt.all(guildId).map((row) => row.role_id);
  }

  persistSnapshot(guildId, roleId, inactiveCount, activeCount) {
    this.insertSnapshot.run(guildId, roleId, inactiveCount, activeCount, DateTime.utc().toSeconds());
  }

  getSnapshots(guildId, sinceDays = 30) {
    const since = DateTime.utc().minus({ days: sinceDays }).toSeconds();
    return this.recentSnapshots.all(guildId, since).map((row) => ({
      roleId: row.role_id,
      inactiveCount: row.inactive_count,
      activeCount: row.active_count,
      capturedAt: DateTime.fromSeconds(row.captured_at, { zone: 'utc' }),
    }));
  }
}
