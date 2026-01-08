import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsBitField,
    Role,
    type CommandInteraction,
} from 'discord.js'
import { logger } from '../../logger.ts'
import { inactivityService } from '../../services/inactivity.service.ts'
import { formatForUser } from '../../utils/time.ts'
import { envs } from '#config'
import type { RoleStatistic } from '../../prisma/generated/browser.ts'
import type { CommandInteractionHandler } from '../../services/interactions.service.ts'
import { roleService } from '../../services/role.service.ts'

/**
 * Genera un código de vinculación de sesión y lo persiste en la base de datos.
 * También intenta enviarlo por DM y responde de forma efímera al usuario.
 */
export default class implements CommandInteractionHandler {
    name = 'inactividad'
    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        if (interaction.commandName !== 'inactividad') return
        if (
            !interaction.memberPermissions?.has(
                PermissionsBitField.Flags.Administrator,
            )
        ) {
            return await interaction.reply({
                content: 'Solo administradores pueden usar estos comandos.',
            })
        }

        const group = interaction.options.getSubcommandGroup(false)
        if (!group) {
            switch (interaction.options.getSubcommand()) {
                case 'listar':
                    return await handleList(interaction)
                case 'estadisticas':
                    return await handleStats(interaction)
                default:
                    return await interaction.reply({
                        content: 'Comando desconocido.',
                    })
            }
        }

        if (group === 'roles') {
            switch (interaction.options.getSubcommand()) {
                case 'agregar':
                    return await handleRoleAdd(interaction)
                case 'eliminar':
                    return await handleRoleRemove(interaction)
                case 'listar':
                    return await handleRoleList(interaction)
                default:
                    return await interaction.reply({
                        content: 'Subcomando desconocido.',
                    })
            }
        }

        await interaction.reply({ content: 'Comando desconocido.' })
    }
}

/**
 * Genera un resumen inmediato del estado de inactividad de todos los
 * miembros pertenecientes a los roles monitoreados, utilizando tanto la
 * caché de Discord como la base de datos.
 */
async function handleList(interaction: CommandInteraction<'cached'>) {
    // Recupera registros en BD y configuración de roles a monitorear.
    const records = await inactivityService.listInactivities(
        interaction.guildId,
    )
    const trackedRoles = await roleService.listRoles(interaction.guildId)

    if (!trackedRoles.length) {
        await interaction.reply({
            content:
                'No hay roles configurados. Usa `/inactividad roles agregar`.',
        })
        return
    }

    // Obtener todos los miembros del servidor (incluyendo offline)
    await interaction.deferReply()
    const allServerMembers = await interaction.guild.members.fetch()

    // Si no se pueden obtener todos, usar role.members como fallback
    if (!allServerMembers || allServerMembers.size === 0) {
        for (const roleId of trackedRoles) {
            const role = await interaction.guild.roles
                .fetch(roleId)
                .catch(() => null)
            if (!role) continue
            for (const [memberId, member] of role.members) {
                if (!allServerMembers.has(memberId)) {
                    allServerMembers.set(memberId, member)
                }
            }
        }
    }

    // Validar que hay miembros
    if (!allServerMembers || allServerMembers.size === 0) {
        await interaction.editReply({
            content: 'No se encontraron miembros con los roles monitoreados.',
        })
        return
    }

    // Filtrar miembros que tienen los roles monitoreados
    const allMembers = new Map()
    for (const [memberId, member] of allServerMembers) {
        for (const roleId of trackedRoles) {
            if (member.roles.cache.has(roleId)) {
                allMembers.set(memberId, member)
                break
            }
        }
    }

    // Separar inactivos y activos
    const inactiveMembers = []
    const activeMembers = []
    const inactiveIds = new Set(records.map(r => r.user_id))

    for (const [memberId, member] of allMembers) {
        if (inactiveIds.has(memberId)) {
            const record = records.find(r => r.user_id === memberId)
            inactiveMembers.push({ member, endsAt: record?.ends_at })
        } else {
            activeMembers.push(member)
        }
    }

    // Crear embed
    const embed = new EmbedBuilder()
        .setTitle('Estado de miembros monitoreados')
        .setColor(0x5865f2)
        .setTimestamp(new Date())
        .setDescription(
            `Total: **${allMembers.size}** | Inactivos: **${inactiveMembers.length}** | Activos: **${activeMembers.length}**`,
        )

    // Agregar campo de inactivos (máximo 50 caracteres por línea, máximo 1024 caracteres totales)
    if (inactiveMembers.length > 0) {
        const maxLines = 20
        const inactiveList = inactiveMembers
            .slice(0, maxLines)
            .map(item => {
                const memberStr = item.member.user.username
                const endStr =
                    item.endsAt ?
                        formatForUser(item.endsAt).substring(0, 30)
                    :   'Sin fecha'
                return `${memberStr} → ${endStr}`
            })
            .join('\n')
        const displayText =
            inactiveMembers.length > maxLines ?
                `${inactiveList}\n... y ${inactiveMembers.length - maxLines} más`
            :   inactiveList
        embed.addFields({
            name: `❌ Inactivos (${inactiveMembers.length})`,
            value: displayText || 'Sin datos',
        })
    } else {
        embed.addFields({
            name: `❌ Inactivos (0)`,
            value: 'No hay miembros inactivos.',
        })
    }

    // Agregar campo de activos (máximo 50 caracteres por línea, máximo 1024 caracteres totales)
    if (activeMembers.length > 0) {
        const maxLines = 20
        const activeList = activeMembers
            .slice(0, maxLines)
            .map(member => member.user.username)
            .join('\n')
        const displayText =
            activeMembers.length > maxLines ?
                `${activeList}\n... y ${activeMembers.length - maxLines} más`
            :   activeList
        embed.addFields({
            name: `✅ Activos (${activeMembers.length})`,
            value: displayText || 'Sin datos',
        })
    } else {
        embed.addFields({
            name: `✅ Activos (0)`,
            value: 'No hay miembros activos.',
        })
    }

    await interaction.editReply({ embeds: [embed] })
}

/**
 * Calcula estadísticas de inactividad por rol, incluyendo porcentajes y
 * tendencias históricas, para su visualización en un embed detallado.
 */
async function handleStats(interaction: CommandInteraction<'cached'>) {
    // Obtiene registros actuales y roles monitoreados para generar métricas.
    const records = await inactivityService.listInactivities(
        interaction.guildId,
    )
    const tracked = await roleService.listRoles(interaction.guildId)
    if (!tracked.length) {
        await interaction.reply({
            content:
                'No hay roles configurados. Usa `/inactividad roles agregar`.',
        })
        return
    }

    // Obtener todos los miembros del servidor (incluyendo offline)
    const allServerMembers = await interaction.guild.members
        .fetch()
        .catch(() => null)

    const summaries = []
    let totalMembers = 0
    let totalInactive = 0
    for (const roleId of tracked) {
        const role = await interaction.guild.roles
            .fetch(roleId)
            .catch(() => null)
        if (!role) continue

        // Filtrar miembros que tienen este rol
        let members
        if (allServerMembers && allServerMembers.size > 0) {
            // Si tenemos todos los miembros, usar eso
            members = allServerMembers.filter(member =>
                member.roles.cache.has(roleId),
            )
        } else {
            // Si no, usar role.members como fallback
            members = role.members
        }

        const inactive = members.filter(member =>
            records.some(record => record.user_id === member.id),
        )
        const activeCount = members.size - inactive.size
        totalMembers += members.size
        totalInactive += inactive.size
        summaries.push({
            role,
            total: members.size,
            inactive: inactive.size,
            active: activeCount,
        })
    }

    if (!summaries.length) {
        return await interaction.reply({
            content: 'No se encontraron roles monitoreados disponibles.',
        })
    }

    const embed = new EmbedBuilder()
        .setTitle('Estadísticas de inactividad')
        .setColor(0x5865f2)
        .setTimestamp(new Date())
        .setDescription('Resumen actualizado de los roles monitoreados.')

    const totalActive = Math.max(totalMembers - totalInactive, 0)
    const totalPercentage =
        totalMembers ? (totalInactive / totalMembers) * 100 : 0
    embed.addFields({
        name: 'Visión general',
        value: `Miembros analizados: **${totalMembers}**\nInactivos: **${totalInactive}** (${totalPercentage.toFixed(1)}%)\nActivos: **${totalActive}**`,
    })

    for (const summary of summaries) {
        const percentage =
            summary.total ? (summary.inactive / summary.total) * 100 : 0
        embed.addFields({
            name: summary.role.name,
            value: `${buildBar(percentage)} ${percentage.toFixed(1)}% inactivos\nInactivos: **${summary.inactive}** | Activos: **${summary.active}**`,
            inline: summaries.length > 1,
        })
    }

    const snapshots = await roleService.getSnapshots(interaction.guildId)
    const historyField = buildHistoryField(snapshots, summaries)
    if (historyField) {
        embed.addFields(historyField)
    }

    await interaction.reply({ embeds: [embed] })
}

async function handleRoleAdd(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    const role = interaction.options.getRole('rol', true)
    roleService.addRole(interaction.guildId, role.id)
    await interaction.reply({ content: `Seguiremos el rol ${role}.` })
    await logAdminAction(
        interaction,
        `${interaction.user} agregó el rol ${role} al seguimiento.`,
    )
}

/**
 * Quita un rol de la lista de seguimiento y registra la acción en el canal
 * de auditoría configurado.
 */
async function handleRoleRemove(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    const role = interaction.options.getRole('rol', true)
    roleService.removeRole(interaction.guildId, role.id)
    await interaction.reply({
        content: `Eliminamos el rol ${role} del seguimiento.`,
    })
    await logAdminAction(
        interaction,
        `${interaction.user} eliminó el rol ${role} del seguimiento.`,
    )
}

/**
 * Lista los roles actualmente vigilados y los devuelve como menciones para
 * facilitar su lectura por parte del administrador.
 */
async function handleRoleList(interaction: CommandInteraction<'cached'>) {
    const roles = await roleService.listRoles(interaction.guildId)
    if (!roles.length) {
        return await interaction.reply({
            content: 'No hay roles monitoreados.',
        })
    }

    const mentions = roles.map(roleId => `<@&${roleId}>`)
    await interaction.reply({
        content: `Roles monitoreados: ${mentions.join(', ')}`,
    })
}

/**
 * Envía un mensaje al canal de auditoría configurado para dejar constancia
 * de las acciones administrativas ejecutadas mediante los comandos del bot.
 */
async function logAdminAction(
    interaction: CommandInteraction<'cached'>,
    message: string,
) {
    if (!envs.adminLogChannelId) return
    try {
        const channel = await interaction.client.channels.fetch(
            envs.adminLogChannelId,
        )
        if (channel?.isTextBased() && 'send' in channel) {
            await channel.send({ content: message })
        }
    } catch (error) {
        logger.warn(
            { err: error },
            'No se pudo enviar mensaje al canal de auditoría',
        )
    }
}

/**
 * Construye una barra textual proporcional al porcentaje indicado.
 */
function buildBar(percentage: number) {
    const width = 12
    const filled = Math.round((percentage / 100) * width)
    const clampedFilled = Math.min(width, Math.max(0, filled))
    const empty = width - clampedFilled
    return `${'█'.repeat(clampedFilled)}${'░'.repeat(empty)}`
}

/**
 * Construye el campo de historial usando datos de snapshots previos para
 * representar tendencias de inactividad por rol.
 */
function buildHistoryField(
    snapshots: RoleStatistic[],
    summaries: Array<{
        role: Role
        total: number
        inactive: number
        active: number
    }>,
) {
    if (!snapshots.length) return null

    const grouped = new Map()
    for (const snapshot of snapshots) {
        if (!grouped.has(snapshot.role_id)) {
            grouped.set(snapshot.role_id, [])
        }
        grouped.get(snapshot.role_id).push(snapshot)
    }

    const lines = []
    for (const summary of summaries) {
        const roleSnapshots = grouped.get(summary.role.id)
        if (!roleSnapshots?.length) continue
        const sorted = [...roleSnapshots].sort(
            (a, b) => a.captured_at.toMillis() - b.captured_at.toMillis(),
        )
        const recent = sorted.slice(-10)
        const sparkline = buildSparkline(
            recent.map(item =>
                percentageInactive(item.inactive_count, item.active_count),
            ),
        )
        const last = recent.at(-1)
        const percentage =
            last ?
                percentageInactive(
                    last.inactive_count,
                    last.active_count,
                ).toFixed(1)
            :   '0.0'
        lines.push(`${summary.role} ${sparkline} (${percentage}%)`)
    }

    if (!lines.length) return null

    return {
        name: 'Historial reciente',
        value: lines.join('\n'),
    }
}

/**
 * Genera una mini-gráfica tipo sparkline usando caracteres de bloques para
 * reflejar variaciones en porcentajes de inactividad.
 */
function buildSparkline(percentages: Array<number>) {
    if (!percentages.length) return 'sin datos'
    const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
    return percentages
        .map(percentage => {
            const index = Math.min(
                blocks.length - 1,
                Math.max(
                    0,
                    Math.round((percentage / 100) * (blocks.length - 1)),
                ),
            )
            return blocks[index]
        })
        .join('')
}

/**
 * Calcula el porcentaje de inactividad dado el número de inactivos y activos.
 */
function percentageInactive(inactive: number, active: number) {
    const total = inactive + active
    if (!total) return 0
    return (inactive / total) * 100
}
