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

        const role = roleService.roles.cache.get(id)
        if (!role) return await interaction.deferUpdate()
        await role.removePlayer(uuid)

        const container = interaction.message.components[0]
        if (!container || container.type !== ComponentType.Container) {
            return false
        }
        const textDisplay = container.components[0]
        if (!textDisplay || textDisplay.type !== ComponentType.TextDisplay) {
            return false
        }

        if (textDisplay.content.includes(role.name)) {
            await interaction.update({
                components: [await roleService.buildRolePannel({ role })],
            })
        }
        await roleService.renderPannel()
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
