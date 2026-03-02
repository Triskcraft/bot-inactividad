import {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { blogService } from '#/services/blog.service.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^blog:title:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        if (!blogService.role)
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Servicio no disponible`,
            })

        if (!interaction.member.roles.cache.has(blogService.role.id))
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `No tienes el rol ${blogService.role}`,
            })
    }
    static override async build({
        id,
    }: {
        id: string
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Cambiar el título')
            .setStyle(ButtonStyle.Primary)
            .setCustomId('blog:title:' + id)
    }
}
