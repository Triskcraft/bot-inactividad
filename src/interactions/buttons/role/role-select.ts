import {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import { roleService } from '../../../services/roles.service.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^role:select:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        })
        const id = this.parser(interaction.customId).get('id')
        const role = roleService.roles.cache.get(id)
        if (!role) {
            return await interaction.editReply({
                content: 'Rol no encontrado',
            })
        }

        await interaction.editReply({
            components: [await roleService.buildRolePannel({ role })],
            flags: MessageFlags.IsComponentsV2,
        })
    }

    static override async build({
        id,
    }: {
        id: string
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Seleccionar')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId('role:select:' + id)
    }
}
