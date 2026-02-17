import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import WhModal from '../../modals/role-create.ts'
import { ButtonInteractionHandler } from '#interactions.service'

export default class extends ButtonInteractionHandler {
    override regex = /^role:create$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        await interaction.showModal(await WhModal.build())
    }
    static override async build(
        _params?: Record<string, unknown>,
    ): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('➕ Crear Rol')
            .setStyle(ButtonStyle.Success)
            .setCustomId('role:create')
    }
}
