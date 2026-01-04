import { MessageFlags, type CommandInteraction } from 'discord.js'
import { db } from '../prisma/database.ts'
import { logger } from '../logger.ts'
import { RANK_ROLES } from '../config.ts'

/**
 * Genera un código de vinculación de sesión y lo persiste en la base de datos.
 * También intenta enviarlo por DM y responde de forma efímera al usuario.
 */
export async function handleCodeDB(interaction: CommandInteraction<'cached'>) {
    const code = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0')
    const discord_id = interaction.user.id
    const username = interaction.user.username
    const discord_nickname = interaction.member?.displayName || username
    const member = await interaction.guild.members.fetch(discord_id)
    const [rank_role] = [...member.roles.cache.values()]
        .map(role => {
            return {
                id: role.id,
                name: role.name,
                position: RANK_ROLES.indexOf(role.id),
            }
        })
        .filter(role => role.position >= 0)
        .sort((a, b) => a.position - b.position)

    try {
        await db.linkCode
            .delete({
                where: { discord_id },
            })
            .catch(() => {
                /* ignore if not found */
            })
        // Se crea un nuevo código asegurando que exista la relación de usuario.
        await db.linkCode.create({
            data: {
                discord_nickname,
                code,
                discord_user: {
                    connectOrCreate: {
                        create: {
                            id: discord_id,
                            rank: rank_role?.name ?? 'Miembro',
                        },
                        where: {
                            id: discord_id,
                        },
                    },
                },
            },
        })

        logger.info(
            { code, discord_id, discord_nickname },
            'Código registrado en BD',
        )
    } catch (error) {
        logger.error(
            { err: error, discord_id },
            'Error al guardar código en BD',
        )
        await interaction.reply({
            content:
                'Ocurrió un error al generar el código. Intenta nuevamente.',
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    try {
        await interaction.user.send({
            content: `Tu código es: **${code}**`,
        })
    } catch (error) {
        logger.warn(
            { err: error, userId: interaction.user.id },
            'No se pudo enviar DM',
        )
    }

    // Respuesta efímera para que solo el solicitante vea el resultado.
    await interaction.reply({
        content: `Tu código es: **${code}**`,
        flags: MessageFlags.Ephemeral,
    })
}
