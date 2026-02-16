import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ModalSubmitInteraction,
} from 'discord.js'
import { ModalInteractionHandler } from '#interactions.service'
import { roleService } from '../../services/roles.service.ts'

export default class extends ModalInteractionHandler {
    override regex = /^role:create$/

    static override async build() {
        return new ModalBuilder()
            .setCustomId('role:create')
            .setTitle('Create a Role')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Nombre')
                    .setDescription('Para identificar el rol')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short),
                    ),
            )
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        await interaction.deferUpdate()
        const name = interaction.fields.getTextInputValue('name')!
        await roleService.createRole(name)
    }
}
