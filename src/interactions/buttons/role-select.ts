import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import { roleService } from '../../services/roles.service.ts'
import { Paginator } from '../../utils/format.ts'
import { randomUUID } from 'node:crypto'

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
        const pages = new Paginator(role.players, { peer: 5 })
        const { page, hasNext, hasPrev, items, totalPages } = pages.get(1)
        for (const { nickname, uuid } of items) {
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`- ${nickname}`),
                    )
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setLabel('Remover')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId(`role:remove:${uuid}`),
                    ),
            )
        }
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`role:prev:${id}`)
                    .setDisabled(hasPrev),
                new ButtonBuilder()
                    .setLabel(`Página ${page} de ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setCustomId(`${randomUUID()}`),
                new ButtonBuilder()
                    .setLabel('Siguiente')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`role:next:${id}`)
                    .setDisabled(hasNext),
                new ButtonBuilder()
                    .setLabel('Eliminar')
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
