import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    TextDisplayBuilder,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import { roleService } from '../../services/roles.service.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^role:select:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        })
        const id = this.parser(interaction.customId).get('id')
        const role = roleService.roleCache().get(id)
        if (!role) {
            return await interaction.editReply({
                content: 'Rol no encontrado',
            })
        }

        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${role.name}\nJugadores con ese rol`,
            ),
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('Eliminar ')
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId(`role:delete:${id}`),
                new ButtonBuilder()
                    .setLabel('Editar')
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId(`role:edit:${id}`),
            ),
        )
        await interaction.editReply({
            components: [container],
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
