import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
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
 * @param {string} customId
 */
export function buildInactivityModal(customId: string) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle('Configurar inactividad')

    const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Duración (ej: 3d, 12h)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)

    const untilInput = new TextInputBuilder()
        .setCustomId('until')
        .setLabel('Fecha exacta (ej: 2024-05-31 18:00)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(untilInput),
    )

    return modal
}
