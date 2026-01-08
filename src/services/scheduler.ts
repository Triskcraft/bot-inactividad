import { DateTime } from 'luxon'
import { Collection, TextChannel } from 'discord.js'
import { logger } from '../logger.ts'
import type { InactivityService } from './inactivity.service.ts'
import type { RoleService } from './role.service.ts'
import { envs } from '../config.ts'
import { client } from '../client.ts'

/**
 * Administra tareas recurrentes del bot.
 */
export class Scheduler {
    inactivityService: InactivityService
    roleService: RoleService
    intervals: Collection<string, NodeJS.Timeout>

    constructor(
        inactivityService: InactivityService,
        roleService: RoleService,
    ) {
        this.inactivityService = inactivityService
        this.roleService = roleService
        this.intervals = new Collection()
    }

    /**
     * Inicia los jobs recurrentes.
     */
    start() {
        this.intervals.set(
            'reminders',
            setInterval(
                () =>
                    this.runReminders().catch(error =>
                        logger.error(error, 'Reminder job failed'),
                    ),
                // Se ejecuta según el intervalo configurable en minutos.
                envs.reminderIntervalMinutes * 60 * 1000,
            ),
        )

        this.intervals.set(
            'snapshots',
            setInterval(
                () =>
                    this.captureSnapshots().catch(error =>
                        logger.error(error, 'Snapshot job failed'),
                    ),
                // Cada 12 horas se toma una fotografía de actividad.
                12 * 60 * 60 * 1000,
            ),
        )
    }

    /**
     * Detiene y limpia todos los temporizadores activos para evitar fugas.
     */
    stop() {
        for (const interval of this.intervals.values()) {
            clearInterval(interval)
        }
        this.intervals.clear()
    }

    /**
     * Revisa las inactividades vencidas y notifica tanto en el canal público
     * como por mensaje directo al miembro correspondiente.
     */
    async runReminders() {
        const channel = (await client.channels.fetch(
            envs.inactivityChannelId,
        )) as TextChannel
        const expired = await this.inactivityService.getExpired(
            channel.guild.id,
        )
        if (!expired.length) return
        if (!channel || !channel.isTextBased()) {
            logger.warn('No se encontró canal de inactividad o no es de texto')
            return
        }

        for (const record of expired) {
            try {
                const member = await channel.guild.members.fetch(record.user_id)
                await channel.send({
                    content: `${member}, tu periodo de inactividad ha finalizado. Te hemos marcado como activo nuevamente.`,
                })
                await member
                    .send(
                        `¡Hola! Tu periodo de inactividad en **TriskCraftSMP** ha finalizado y ya puedes volver a participar.`,
                    )
                    .catch(() => null)
                this.inactivityService.clearInactivity(record.user_id)
                logger.info(
                    { userId: record.user_id },
                    'Notificación de finalización enviada',
                )
            } catch (error) {
                logger.error(
                    { err: error, userId: record.user_id },
                    'No se pudo notificar a un miembro',
                )
                this.inactivityService.clearInactivity(record.user_id)
            }
        }
    }

    /**
     * Captura un snapshot del conteo de miembros activos/inactivos por cada
     * rol monitoreado, útil para estadísticas y seguimiento histórico.
     */
    async captureSnapshots() {
        const guild = await client.guilds.fetch(envs.guildId as string)
        const trackedRoles = await this.roleService.listRoles(guild.id)
        const now = DateTime.utc()
        const inactivityRecords = await this.inactivityService.listInactivities(
            guild.id,
        )

        for (const roleId of trackedRoles) {
            try {
                const role = await guild.roles.fetch(roleId)
                if (!role) continue

                const members = role.members
                const inactive = members.filter(member =>
                    inactivityRecords.some(
                        record => record.user_id === member.id,
                    ),
                )
                const activeCount = members.size - inactive.size
                this.roleService.persistSnapshot(
                    guild.id,
                    roleId,
                    inactive.size,
                    activeCount,
                )
                logger.debug(
                    {
                        roleId,
                        inactive: inactive.size,
                        active: activeCount,
                        capturedAt: now.toISO(),
                    },
                    'Snapshot capturado',
                )
            } catch (error) {
                logger.error(
                    { err: error, roleId },
                    'No se pudo generar snapshot para rol',
                )
            }
        }
    }
}
