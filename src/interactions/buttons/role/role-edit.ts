import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import roleEdit from '../../modals/role-edit.ts'
import { minecraftRolesManager } from '../../../classes/minecraft-roles-manager.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^role:edit:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        const parser = this.parser(interaction.customId)
        const id = parser.get('id')

        const role = minecraftRolesManager.cache.get(id)
        if (!role) return await interaction.deferUpdate()
        await interaction.showModal(await roleEdit.build({ role }))
    }
    static override async build({
        id,
    }: {
        id: string
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Editar')
            .setStyle(ButtonStyle.Primary)
            .setCustomId(`role:edit:${id}`)
    }
}
