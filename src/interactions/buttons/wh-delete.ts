import {
    MessageFlags,
    PermissionFlagsBits,
    type ButtonInteraction,
} from 'discord.js'
import WhModal from '../modals/webhook-delete.ts'
import { ButtonInteractionHandler } from '#interactions.service'

export default class extends ButtonInteractionHandler {
    override regex = /^wh:delete:(.+)$/

    override async run(interaction: ButtonInteraction<'cached'>) {
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
        await interaction.showModal(
            await WhModal.build({
                id: this.regex.exec(interaction.customId)![1]!,
            }),
        )
    }
}
