import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    CommandInteraction,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    ModalSubmitInteraction,
    PermissionsBitField,
    Role,
} from 'discord.js'
import { DateTime } from 'luxon'
import { buildInactivityModal } from '../interactions/inactivityPanel.ts'
import { parseUserTime, formatForUser } from '../utils/time.ts'
import { logger } from '../logger.ts'
import type { InactivityService } from '../services/inactivityService.ts'
import type { RoleService } from '../services/roleService.ts'
import { envs } from '../config.ts'
import type { RoleStatistic } from '../prisma/generated/client.ts'
import { handleCodeDB } from '../commands/dis-session.command.ts'
import { client } from '../client.ts'

/**
 * Registra los manejadores principales de interacciones de Discord
 * (botones, modales y slash commands) delegando la lógica a los servicios
 * especializados. Se ejecuta una sola vez durante el arranque del bot.
 */
export async function registerInteractionHandlers({
    inactivityService,
    roleService,
}: {
    inactivityService: InactivityService
    roleService: RoleService
}) {
    client.on('interactionCreate', async interaction => {
        try {
            if (interaction.isButton()) {
                await handleButton(interaction, inactivityService)
            } else if (interaction.isModalSubmit()) {
                await handleModal(interaction, inactivityService)
            } else if (interaction.isChatInputCommand()) {
                // Los slash commands se tipan como 'cached' para garantizar que
                // la información de guild está disponible al manejarlos.
                await handleCommand(
                    interaction as ChatInputCommandInteraction<'cached'>,
                    inactivityService,
                    roleService,
                )
            }
        } catch (error) {
            logger.error(
                { err: error, interaction: interaction.id },
                'Error procesando interacción',
            )
            if (interaction.isRepliable()) {
                const replyContent =
                    'Ocurrió un error inesperado al procesar tu solicitud.'
                const ephemeral = !(
                    interaction.isChatInputCommand() &&
                    interaction.commandName === 'inactividad'
                )
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: replyContent,
                        ephemeral,
                    })
                } else {
                    await interaction.reply({
                        content: replyContent,
                        ephemeral,
                    })
                }
            }
        }
    })
}

/**
 * Manejador central de botones del panel de inactividad. Cada botón ejecuta
 * una acción distinta: crear/editar, limpiar o mostrar el estado del usuario.
 */
async function handleButton(
    interaction: ButtonInteraction,
    inactivityService: InactivityService,
) {
    // Los botones solo son válidos dentro de un servidor; evita uso en MD.
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'Solo disponible dentro del servidor.',
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    const member = interaction.member as GuildMember

    switch (interaction.customId) {
        case 'inactivity:set':
        case 'inactivity:edit': {
            // Muestra el modal que permite indicar fecha o duración.
            await interaction.showModal(
                buildInactivityModal(
                    interaction.customId === 'inactivity:set' ?
                        'modal:set'
                    :   'modal:edit',
                ),
            )
            break
        }
        case 'inactivity:clear': {
            inactivityService.clearInactivity(member.id)
            await interaction.reply({
                content: 'Tu inactividad fue eliminada. ¡Bienvenido de vuelta!',
                flags: MessageFlags.Ephemeral,
            })
            break
        }
        case 'inactivity:show': {
            const record = await inactivityService.getInactivity(member.id)
            if (!record) {
                await interaction.reply({
                    content: 'No tienes inactividad registrada.',
                    flags: MessageFlags.Ephemeral,
                })
                return
            }

            await interaction.reply({
                content: `Estarás inactivo hasta ${formatForUser(record.ends_at)}.`,
                flags: MessageFlags.Ephemeral,
            })
            break
        }
        default:
            await interaction.reply({
                content: 'Acción desconocida.',
                flags: MessageFlags.Ephemeral,
            })
    }
}

/**
 * Procesa los formularios enviados desde el modal de inactividad validando
 * que exista al menos un campo y que la fecha indicada sea futura.
 */
async function handleModal(
    interaction: ModalSubmitInteraction,
    inactivityService: InactivityService,
) {
    const duration = interaction.fields.getTextInputValue('duration')
    const until = interaction.fields.getTextInputValue('until')

    // Ambos campos son opcionales, pero al menos uno debe contener valor.
    if (!duration && !until) {
        await interaction.reply({
            content: 'Debes completar al menos uno de los campos.',
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    try {
        const reference = until || duration
        const { until: untilDate } = parseUserTime(reference)
        if (untilDate.toMillis() <= DateTime.utc().toMillis()) {
            await interaction.reply({
                content:
                    'La fecha indicada ya pasó. Por favor ingresa un valor en el futuro.',
                flags: MessageFlags.Ephemeral,
            })
            return
        }
        inactivityService.markInactivity(
            interaction.guildId!,
            interaction.member as GuildMember,
            untilDate.toJSDate(),
            interaction.customId,
        )
        // Respuesta privada para evitar spam en el canal de interacción.
        await interaction.reply({
            content: `Registramos tu inactividad hasta ${formatForUser(untilDate.toJSDate())}.`,
            flags: MessageFlags.Ephemeral,
        })
    } catch (error) {
        await interaction.reply({
            content: (error as Error).message,
            flags: MessageFlags.Ephemeral,
        })
    }
}

/**
 * Enruta los comandos de barra hacia el manejador correspondiente según el
 * nombre del comando recibido.
 */
async function handleCommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    inactivityService: InactivityService,
    roleService: RoleService,
) {
    if (interaction.commandName === 'inactividad')
        return inactividadCommand(interaction, inactivityService, roleService)
    if (interaction.commandName === 'dis-session')
        return handleCodeDB(interaction)
    await interaction.reply({ content: 'Comando desconocido.' })
}

/**
 * Agrupa la lógica del comando administrativo `/inactividad`, verificando
 * permisos y delegando en los subcomandos individuales.
 */
async function inactividadCommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    inactivityService: InactivityService,
    roleService: RoleService,
) {
    if (interaction.commandName !== 'inactividad') return
    if (
        !interaction.memberPermissions?.has(
            PermissionsBitField.Flags.Administrator,
        )
    ) {
        await interaction.reply({
            content: 'Solo administradores pueden usar estos comandos.',
        })
        return
    }

    const group = interaction.options.getSubcommandGroup(false)
    if (!group) {
        switch (interaction.options.getSubcommand()) {
            case 'listar':
                await handleList(interaction, inactivityService, roleService)
                return
            case 'estadisticas':
                await handleStats(interaction, inactivityService, roleService)
                return
            default:
                await interaction.reply({ content: 'Comando desconocido.' })
                return
        }
    }

    if (group === 'roles') {
        switch (interaction.options.getSubcommand()) {
            case 'agregar':
                await handleRoleAdd(interaction, roleService)
                return
            case 'eliminar':
                await handleRoleRemove(interaction, roleService)
                return
            case 'listar':
                await handleRoleList(interaction, roleService)
                return
            default:
                await interaction.reply({ content: 'Subcomando desconocido.' })
                return
        }
    }

    await interaction.reply({ content: 'Comando desconocido.' })
}

/**
 * Genera un resumen inmediato del estado de inactividad de todos los
 * miembros pertenecientes a los roles monitoreados, utilizando tanto la
 * caché de Discord como la base de datos.
 */
async function handleList(
    interaction: CommandInteraction<'cached'>,
    inactivityService: InactivityService,
    roleService: RoleService,
) {
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
async function handleStats(
    interaction: CommandInteraction<'cached'>,
    inactivityService: InactivityService,
    roleService: RoleService,
) {
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
        await interaction.reply({
            content: 'No se encontraron roles monitoreados disponibles.',
        })
        return
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
    roleService: RoleService,
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
    roleService: RoleService,
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
async function handleRoleList(
    interaction: CommandInteraction<'cached'>,
    roleService: RoleService,
) {
    const roles = await roleService.listRoles(interaction.guildId)
    if (!roles.length) {
        await interaction.reply({ content: 'No hay roles monitoreados.' })
        return
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
