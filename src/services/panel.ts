import { client } from '#client'
import { envs } from '#config'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} from '@discordjs/builders'
import { ButtonStyle, MessageFlags, type SendableChannels } from 'discord.js'
import { logger } from '#logger'
import { db } from '#database'

export async function deployAdminPanel() {
    const channel = await client.channels.fetch(envs.PANEL_CHANNEL_ID)
    if (!channel) {
        return logger.warn('Canal de panel no encontrado')
    }
    if (!channel.isSendable()) {
        return logger.warn('El canal de pannel no está disponible')
    }
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '🔐 **Panel de Webhooks**\n' +
                    'Administra los tokens usados por la web y el servidor de Minecraft.',
            ),
        )
        .addSeparatorComponents(new SeparatorBuilder())

    const tokens = await db.webhookToken.findMany({
        orderBy: { created_at: 'desc' },
    })
    for (const token of tokens) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${token.name}**\n` +
                            `Creado el <t:${Math.floor(token.created_at.getTime() / 1000)}:d> por <@${token.discord_user_id}>`,
                    ),
                )
                .setButtonAccessory(
                    new ButtonBuilder()
                        .setLabel('Eliminar')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`wh:delete:${token.id}`),
                ),
        )
    }
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('➕ Crear token')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('wh:add'),
        ),
    )
    const whpmid = await db.state.findUnique({
        where: { key: 'wh_panel_message_id' },
        select: { value: true },
    })
    if (whpmid) {
        const anc = await channel.messages.fetch(whpmid.value)
        if (anc) {
            await anc.edit({
                components: [container],
            })
        } else {
            await resend(channel, container)
        }
    } else {
        await resend(channel, container)
    }
}

async function resend(channel: SendableChannels, container: ContainerBuilder) {
    const nmsg = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
    })
    await db.state.upsert({
        where: { key: 'wh_panel_message_id' },
        update: { value: nmsg.id },
        create: { key: 'wh_panel_message_id', value: nmsg.id },
    })
}
