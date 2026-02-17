import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ModalSubmitInteraction,
} from 'discord.js'
import { ModalInteractionHandler } from '#interactions.service'
import { RoleCached, roleService } from '../../services/roles.service.ts'

export default class extends ModalInteractionHandler<'id'> {
    override regex = /^role:edit:(?<id>\d+)$/

    static override async build({ role }: { role: RoleCached }) {
        return new ModalBuilder()
            .setCustomId(`role:edit:${role.id}`)
            .setTitle('Edita el rol ' + role.name)
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Nombre')
                    .setDescription('Para identificar el rol')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short)
                            .setValue(role.name),
                    ),
            )
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        await interaction.deferUpdate()
        const name = interaction.fields.getTextInputValue('name')!
        const id = this.parser(interaction.customId).get('id')
        await roleService.editRole({ id, name })
    }
}
