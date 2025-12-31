import { formatForUser } from '../utils/time.js';
import type { InactivityPeriod } from "../prisma/generated/client.js"
import type { GuildMember } from 'discord.js';
import { db } from '../prisma/database.js';

/**
 * Servicio encargado de persistir y exponer los estados de inactividad.
 */
export class InactivityService {
  /**
   * Marca la inactividad para un usuario.
   */
  async markInactivity(guild_id: string, member: GuildMember, until: Date, source: string) {
    const result = await db.inactivityPeriod.upsert({
      where: {
        user_id: member.id,
      },
      create: {
        discord_user: {
          connectOrCreate: {
            create: { id: member.id },
            where: { id: member.id }
          }
        },
        guild_id,
        role_snapshot: JSON.stringify(member.roles.cache.map((role) => role.id)),
        started_at: new Date(),
        ends_at: until,
        source: source,
        notified: false,
      },
      update: {
        role_snapshot: JSON.stringify(member.roles.cache.map((role) => role.id)),
        started_at: new Date(),
        ends_at: until,
        source: source,
        notified: false,
      },
    })
    return result;
  }

  /**
   * Elimina la inactividad de un usuario.
   */
  async clearInactivity(user_id: string) {
    await db.inactivityPeriod.delete({
      where: { user_id }
    })
  }

  /**
   * Obtiene la inactividad actual del usuario.
   */
  async getInactivity(user_id: string) {
    const result = await db.inactivityPeriod.findFirst({
      where: { user_id }
    })
    if (!result) return null;
    return mapRow(result);
  }

  /**
   * Lista inactividades de un servidor.
   */
  async listInactivities(guild_id: string) {
    const result = await db.inactivityPeriod.findMany({
      where: { guild_id },
      orderBy: { ends_at: "asc" }
    })
    return result.map(mapRow);
  }

  /**
   * Busca inactividades vencidas sin notificar.
   */
  async getExpired(guild_id: string) {
    const result = await db.inactivityPeriod.findMany({
      where: { guild_id, notified: false, ends_at: { lte: new Date() } }
    })
    return result.map(mapRow);
  }

  /**
   * Construye un texto user-friendly de la inactividad.
   */
  async describe(member: GuildMember) {
    const record = await this.getInactivity(member.id);
    if (!record) {
      return `${member} no tiene inactividad registrada.`;
    }

    return `${member} permanecerá inactivo hasta ${formatForUser(record.ends_at)}.`;
  }
}

function mapRow(row: InactivityPeriod) {
  return {
    ...row,
    role_snapshot: JSON.parse(row.role_snapshot),
  };
}
