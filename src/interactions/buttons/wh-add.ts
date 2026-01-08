import {
    MessageFlags,
    PermissionFlagsBits,
    type ButtonInteraction,
} from 'discord.js'
import WhModal from '../modals/webhook.ts'
import type { ButtonInteractionHandler } from '../services/interactions.service.ts'

export default class implements ButtonInteractionHandler {
    regex = /^wh:add$/
    async run(interaction: ButtonInteraction<'cached'>) {
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            return interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: 'No tienes permisos para usar esto',
            })
        }
        await interaction.showModal(WhModal.build())
    }
}
