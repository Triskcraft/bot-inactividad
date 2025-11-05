import { DateTime } from 'luxon';
import { formatForUser } from '../utils/time.js';

/**
 * Servicio encargado de persistir y exponer los estados de inactividad.
 */
export class InactivityService {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this.db = db;
    this.insertStmt = db.prepare(`
      INSERT INTO inactivity_periods (user_id, guild_id, role_snapshot, started_at, ends_at, source, notified)
      VALUES (@userId, @guildId, @roleSnapshot, @startedAt, @endsAt, @source, @notified)
      ON CONFLICT(user_id)
      DO UPDATE SET
        role_snapshot = excluded.role_snapshot,
        started_at = excluded.started_at,
        ends_at = excluded.ends_at,
        source = excluded.source,
        notified = excluded.notified
    `);
    this.deleteStmt = db.prepare('DELETE FROM inactivity_periods WHERE user_id = ?');
    this.findStmt = db.prepare('SELECT * FROM inactivity_periods WHERE user_id = ?');
    this.listStmt = db.prepare('SELECT * FROM inactivity_periods WHERE guild_id = ? ORDER BY ends_at ASC');
    this.pendingStmt = db.prepare('SELECT * FROM inactivity_periods WHERE notified = 0 AND ends_at <= ? AND guild_id = ?');
  }

  /**
   * Marca la inactividad para un usuario.
   * @param {string} guildId
   * @param {import('discord.js').GuildMember} member
   * @param {DateTime} until
   * @param {string} source
   */
  markInactivity(guildId, member, until, source) {
    const payload = {
      userId: member.id,
      guildId,
      roleSnapshot: JSON.stringify(member.roles.cache.map((role) => role.id)),
      startedAt: DateTime.utc().toSeconds(),
      endsAt: until.toSeconds(),
      source,
      notified: 0,
    };
    this.insertStmt.run(payload);
    return payload;
  }

  /**
   * Elimina la inactividad de un usuario.
   * @param {string} userId
   */
  clearInactivity(userId) {
    this.deleteStmt.run(userId);
  }

  /**
   * Obtiene la inactividad actual del usuario.
   * @param {string} userId
   */
  getInactivity(userId) {
    const result = this.findStmt.get(userId);
    if (!result) return null;
    return mapRow(result);
  }

  /**
   * Lista inactividades de un servidor.
   * @param {string} guildId
   */
  listInactivities(guildId) {
    return this.listStmt.all(guildId).map(mapRow);
  }

  /**
   * Busca inactividades vencidas sin notificar.
   * @param {string} guildId
   */
  getExpired(guildId) {
    return this.pendingStmt.all(DateTime.utc().toSeconds(), guildId).map(mapRow);
  }

  /**
   * Construye un texto user-friendly de la inactividad.
   * @param {import('discord.js').GuildMember} member
   */
  describe(member) {
    const record = this.getInactivity(member.id);
    if (!record) {
      return `${member} no tiene inactividad registrada.`;
    }

    return `${member} permanecerá inactivo hasta ${formatForUser(record.endsAt)}.`;
  }
}

function mapRow(row) {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    roleSnapshot: JSON.parse(row.role_snapshot),
    startedAt: DateTime.fromSeconds(row.started_at, { zone: 'utc' }),
    endsAt: DateTime.fromSeconds(row.ends_at, { zone: 'utc' }),
    source: row.source,
    notified: Boolean(row.notified),
  };
}
