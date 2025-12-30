import type { CommandInteraction } from "discord.js";
import { db } from "../prisma/database.js";
import { logger } from "../logger.js";

export async function handleCodeDB(interaction: CommandInteraction<"cached">) {
    const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const discord_id = interaction.user.id;
    const username = interaction.user.username;
    const discord_nickname = interaction.member?.displayName || username;

    try {
        await db.linkCode.delete({
            where: { discord_id }
        }).catch(() => { /* ignore if not found */ });
        await db.linkCode.create({
            data: { discord_id, discord_nickname, code }
        })

        logger.info({ code, discord_id, discord_nickname }, 'Código registrado en BD');
    } catch (error) {
        logger.error({ err: error, discord_id }, 'Error al guardar código en BD');
        await interaction.reply({
            content: 'Ocurrió un error al generar el código. Intenta nuevamente.',
            ephemeral: true
        });
        return;
    }

    try {
        await interaction.user.send({
            content: `Tu código es: **${code}**`
        });
    } catch (error) {
        logger.warn({ err: error, userId: interaction.user.id }, 'No se pudo enviar DM');
    }

    await interaction.reply({
        content: `Tu código es: **${code}**`,
        ephemeral: true
    });
}