import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
} from 'discord.js'
import { inactivityService } from '#inactivity.service'
import { formatForUser } from '../../utils/time.ts'
import type { ButtonInteractionHandler } from '#interactions.service'

export default class implements ButtonInteractionHandler {
    regex = /^inactivity:.*/
    async run(interaction: ButtonInteraction<'cached'>) {
        switch (interaction.customId) {
            case 'inactivity:set':
            case 'inactivity:edit': {
                // Muestra el modal que permite indicar fecha o duración.
                await interaction.showModal(
                    buildInactivityModal(
                        interaction.customId === 'inactivity:set' ?
                            'modal:set'
                        :   'modal:edit',
                    ),
                )
                break
            }
            case 'inactivity:clear': {
                inactivityService.clearInactivity(interaction.member.id)
                await interaction.reply({
                    content:
                        'Tu inactividad fue eliminada. ¡Bienvenido de vuelta!',
                    flags: MessageFlags.Ephemeral,
                })
                break
            }
            case 'inactivity:show': {
                const record = await inactivityService.getInactivity(
                    interaction.member.id,
                )
                if (!record) {
                    await interaction.reply({
                        content: 'No tienes inactividad registrada.',
                        flags: MessageFlags.Ephemeral,
                    })
                    return
                }

                await interaction.reply({
                    content: `Estarás inactivo hasta ${formatForUser(record.ends_at)}.`,
                    flags: MessageFlags.Ephemeral,
                })
                break
            }
            default:
                await interaction.reply({
                    content: 'Acción desconocida.',
                    flags: MessageFlags.Ephemeral,
                })
        }
    }
}

/**
 * Crea un modal para solicitar información de inactividad.
 */
export function buildInactivityModal(customId: string) {
    // Campo para recibir una duración en formato libre (ej. "3d 4h").
    const durationInput = new LabelBuilder()
        .setLabel('Fecha exacta (ej: 2024-05-31 18:00)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('duration')
                .setStyle(TextInputStyle.Short)
                .setRequired(false),
        )

    // Campo alternativo para ingresar una fecha absoluta concreta.
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
