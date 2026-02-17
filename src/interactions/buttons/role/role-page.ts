import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import { roleService } from '../../../services/roles.service.ts'

export default class extends ButtonInteractionHandler<'page' | 'id'> {
    override regex = /^role:page:(?<id>\d+):(?<page>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        const parser = this.parser(interaction.customId)
        const id = parser.get('id')
        const page = +parser.get('page')

        const role = roleService.roleCache().get(id)
        if (!role) return await interaction.deferUpdate()
        await interaction.update({
            components: [await roleService.buildRolePannel({ role, page })],
        })
    }
    static override async build({
        id,
        page,
        label,
        disabled = false,
    }: {
        id: string
        page: number
        label: string
        disabled: boolean
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`role:page:${id}:${page}`)
            .setDisabled(disabled)
    }
}
