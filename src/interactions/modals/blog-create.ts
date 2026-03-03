import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ModalSubmitInteraction,
} from 'discord.js'
import { ModalInteractionHandler } from '#/services/interactions.service.ts'
import { blogService } from '#/services/blog.service.ts'

export default class extends ModalInteractionHandler {
    override regex = /^blog:create$/

    static override async build() {
        return new ModalBuilder()
            .setCustomId(`blog:create`)
            .setTitle('Nuevo draft')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Nombre del post')
                    .setDescription(
                        'Máximo 100 caracteres. Se puede editar después',
                    )
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(100),
                    ),
            )
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        await interaction.deferUpdate()
        const name = interaction.fields.getTextInputValue('name')!
        await blogService.createDraft({
            member: interaction.member,
            title: name,
        })
    }
}
