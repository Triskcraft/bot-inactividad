import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
} from 'discord.js'
import type { ButtonInteractionHandler } from '../interactions/class.ts'

export default class implements ButtonInteractionHandler {
    regex = /^wh:add$/
    constructor() {}
    async run(interaction: ButtonInteraction<'cached'>) {
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            return interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: 'No tienes permisos para usar esto',
            })
        }
        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('wh:add')
                .setTitle('Create a Webhook Token')
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel('Permisos')
                        .setStringSelectMenuComponent(
                            new StringSelectMenuBuilder()
                                .setCustomId('permissions')
                                .setRequired(true)
                                .setMinValues(1)
                                .addOptions(
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel('digs')
                                        .setValue('digs')
                                        .setDescription('Webhook de digs'),
                                ),
                        ),
                    new LabelBuilder()
                        .setLabel('Nombre')
                        .setDescription('Para identificar el token')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId('name')
                                .setRequired(true)
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false),
                        ),
                ),
        )
    }
}
