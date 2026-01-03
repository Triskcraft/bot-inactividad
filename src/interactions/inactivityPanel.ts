import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'

/**
 * Crea el embed y botones principales para la auto-gestión.
 */
export function buildInactivityPanel() {
    const embed = new EmbedBuilder()
        .setTitle('Gestión de Inactividad')
        .setDescription(
            'Administra tus periodos de ausencia utilizando los botones de abajo. Todas las respuestas del bot serán efímeras y solo tú podrás verlas.',
        )
        .setColor(0x5865f2)

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('inactivity:set')
            .setLabel('Marcar inactividad')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('inactivity:edit')
            .setLabel('Modificar inactividad')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('inactivity:clear')
            .setLabel('Desmarcar inactividad')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('inactivity:show')
            .setLabel('Mostrar estado')
            .setStyle(ButtonStyle.Success),
    )

    return { embed, components: [buttons] }
}

/**
 * Crea un modal para solicitar información de inactividad.
 */
export function buildInactivityModal(customId: string) {
    const durationInput = new LabelBuilder()
        .setLabel('Fecha exacta (ej: 2024-05-31 18:00)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('duration')
                .setStyle(TextInputStyle.Short)
                .setRequired(false),
        )

    const untilInput = new LabelBuilder()
        .setLabel('Fecha exacta (ej: 2024-05-31 18:00)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('until')
                .setStyle(TextInputStyle.Short)
                .setRequired(false),
        )

    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle('Configurar inactividad')
        .addLabelComponents([durationInput, untilInput])
}
