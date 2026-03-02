import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { roleService } from '#/services/roles.service.ts'

export default class extends ButtonInteractionHandler<'uuid' | 'id'> {
    override regex = /^role:remove:(?<id>\d+):(?<uuid>.+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferUpdate()

        const parser = this.parser(interaction.customId)
        const id = parser.get('id')
        const uuid = parser.get('uuid')
        const role = roleService.roles.cache.get(id)
        if (!role) return

        await role.removePlayer(uuid)
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
