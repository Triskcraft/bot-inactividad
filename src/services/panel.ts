import { client } from '#client'
import { envs } from '#config'
import {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
} from '@discordjs/builders'
import { ButtonStyle, type BaseMessageOptions } from 'discord.js'
import { logger } from '../logger.ts'

export async function deployAdminPanel() {
    const channel = await client.channels.fetch(envs.PANEL_CHANNEL_ID)
    if (!channel) {
        return logger.warn('Canal de panel no encontrado')
    }
    if (!channel.isTextBased()) {
        return logger.warn('El canal de pannel no está disponible')
    }
    if (!channel.isSendable()) {
        return logger.warn('El canal de pannel no está disponible')
    }
    const messages = await channel.messages.fetch({ limit: 32 })
    const anchor = messages.find(
        message =>
            message.author.id === client.user.id &&
            message.components.length > 0,
    )
    const embed = new EmbedBuilder()
        .setTitle('Admin Panel')
        .setThumbnail(client.user.avatarURL())
        .setDescription(
            'Funciona como un dashboard para las funciones de la web y administrativas',
        )
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('wh:add')
            .setLabel('Crear Token')
            .setStyle(ButtonStyle.Primary),
    )
    const toSend: BaseMessageOptions = {
        embeds: [embed],
        components: [buttons],
    }
    if (anchor) await anchor.edit(toSend)
    else await channel.send(toSend)
}
