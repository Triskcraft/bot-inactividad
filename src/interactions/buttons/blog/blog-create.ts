import {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import blogCreate from '#/interactions/modals/blog-create.ts'
import { blogService } from '#/services/blog.service.ts'

export default class extends ButtonInteractionHandler {
    override regex = /^blog:create$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        if (!blogService.role)
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Servicio no disponible`,
            })

        if (interaction.member.roles.cache.has(blogService.role.id))
            await interaction.showModal(await blogCreate.build())
        else
            await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `No tienes el rol ${blogService.role}`,
            })
    }
    static override async build(
        _params?: Record<string, unknown>,
    ): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Crear un draft')
            .setStyle(ButtonStyle.Success)
            .setCustomId('blog:create')
    }
}
