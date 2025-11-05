import { DateTime } from 'luxon';
import { Collection } from 'discord.js';
import { logger } from '../logger.js';

/**
 * Administra tareas recurrentes del bot.
 */
export class Scheduler {
  /**
   * @param {import('./inactivityService.js').InactivityService} inactivityService
   * @param {import('./roleService.js').RoleService} roleService
   * @param {import('discord.js').Client} client
   * @param {import('../config.js').BotConfig} config
   */
  constructor(inactivityService, roleService, client, config) {
    this.inactivityService = inactivityService;
    this.roleService = roleService;
    this.client = client;
    this.config = config;
    this.intervals = new Collection();
  }

  /**
   * Inicia los jobs recurrentes.
   */
  start() {
    this.intervals.set(
      'reminders',
      setInterval(() => this.runReminders().catch((error) => logger.error(error, 'Reminder job failed')),
        this.config.reminderIntervalMinutes * 60 * 1000),
    );

    this.intervals.set(
      'snapshots',
      setInterval(() => this.captureSnapshots().catch((error) => logger.error(error, 'Snapshot job failed')),
        12 * 60 * 60 * 1000),
    );
  }

  stop() {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  async runReminders() {
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const expired = this.inactivityService.getExpired(guild.id);
    if (!expired.length) return;

    const channel = await guild.channels.fetch(this.config.inactivityChannelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn('No se encontró canal de inactividad o no es de texto');
      return;
    }

    for (const record of expired) {
      try {
        const member = await guild.members.fetch(record.userId);
        await channel.send({ content: `${member}, tu periodo de inactividad ha finalizado.` });
        this.inactivityService.markNotified(record.userId);
        logger.info({ userId: record.userId }, 'Notificación de finalización enviada');
      } catch (error) {
        logger.error({ err: error, userId: record.userId }, 'No se pudo notificar a un miembro');
      }
    }
  }

  async captureSnapshots() {
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const trackedRoles = this.roleService.listRoles(guild.id);
    const now = DateTime.utc();
    const inactivityRecords = this.inactivityService.listInactivities(guild.id);

    for (const roleId of trackedRoles) {
      try {
        const role = await guild.roles.fetch(roleId);
        if (!role) continue;

        const members = role.members;
        const inactive = members.filter((member) => inactivityRecords.some((record) => record.userId === member.id));
        const activeCount = members.size - inactive.size;
        this.roleService.persistSnapshot(guild.id, roleId, inactive.size, activeCount);
        logger.debug({ roleId, inactive: inactive.size, active: activeCount, capturedAt: now.toISO() }, 'Snapshot capturado');
      } catch (error) {
        logger.error({ err: error, roleId }, 'No se pudo generar snapshot para rol');
      }
    }
  }
}
