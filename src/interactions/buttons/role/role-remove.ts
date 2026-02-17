import {
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import { roleService } from '../../../services/roles.service.ts'

export default class extends ButtonInteractionHandler<'uuid' | 'id'> {
    override regex = /^role:remove:(?<id>\d+):(?<uuid>.+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        const parser = this.parser(interaction.customId)
        const id = parser.get('id')
        const uuid = parser.get('uuid')

        await roleService.removeRoleFromPlayer({
            roleId: id,
            playerUUID: uuid,
        })

        const role = roleService.roleCache().get(id)
        if (!role) return await interaction.deferUpdate()

        const container = interaction.message.components[0]
        if (!container) return false
        if (container.type !== ComponentType.Container) return false
        const textDisplay = container.components[0]
        if (!textDisplay) return false
        if (textDisplay.type !== ComponentType.TextDisplay) return false

        if (textDisplay.content.includes(roleService.pannelName)) {
            await roleService.renderPannel()
        } else {
            await interaction.update({
                components: [await roleService.buildRolePannel({ role })],
            })
        }
    }
    static override async build({
        id,
        uuid,
    }: {
        id: string
        uuid: string
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Remover')
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`role:remove:${id}:${uuid}`)
    }
}
