import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#interactions.service'
import { roleService } from '../../services/roles.service.ts'
import { envs } from '#config'

export default class RoleDelete extends ButtonInteractionHandler<'id' | 'q'> {
    override regex = /^role:delete:(?<id>\d+):(?<q>q|y|n+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        const parser = this.parser(interaction.customId)
        const id = parser.get('id')
        const q = parser.get('q') as 'q' | 'y' | 'n'

        const role = roleService.roleCache().get(id)
        if (!role) return await interaction.deferUpdate()
        console.log(q)

        switch (q) {
            case 'q': {
                return await interaction.update({
                    components: [
                        new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `# ${role.name}\nEstas seguro de eliminar este rol?\nEsta acción no se puede deshacer`,
                                ),
                            )
                            .addActionRowComponents(
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    await RoleDelete.build({
                                        id: role.id,
                                        q: 'n',
                                    }),
                                    await RoleDelete.build({
                                        id: role.id,
                                        q: 'y',
                                    }),
                                ),
                            ),
                    ],
                })
            }
            case 'n': {
                await roleService.deleteRole({ id: role.id })
                return await interaction.update({
                    components: [await roleService.buildRolePannel({ role })],
                })
            }
            case 'y': {
                await roleService.deleteRole({ id })
                return await interaction.update({
                    components: [
                        new ContainerBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `# ${role.name}\nRol eliminado`,
                            ),
                        ),
                    ],
                })
            }
            default: {
                q satisfies never
            }
        }
    }
    static override async build({
        id,
        q = 'q',
    }: {
        id: string
        q?: 'q' | 'y' | 'n'
    }): Promise<ButtonBuilder> {
        console.log(
            q,
            q === 'q' ? 'Eliminar'
            : q === 'n' ? 'Si, quiero eliminarlo'
            : 'No, deseo conservarlo',
        )

        return new ButtonBuilder()
            .setLabel(
                q === 'q' ? 'Eliminar'
                : q === 'n' ? 'No, deseo conservarlo'
                : 'Si, quiero eliminarlo',
            )
            .setStyle(q === 'n' ? ButtonStyle.Success : ButtonStyle.Danger)
            .setCustomId(`role:delete:${id}:${q}`)
            .setDisabled(id === envs.DEFAULT_ROLE_ID)
    }
}
