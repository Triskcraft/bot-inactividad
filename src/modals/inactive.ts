import { MessageFlags, type ModalSubmitInteraction } from 'discord.js'
import type { ModalInteractionHandler } from '../interactions/class.ts'
import { inactivityService } from '../services/inactivityService.ts'
import { formatForUser, parseUserTime } from '../utils/time.ts'
import { DateTime } from 'luxon'

export default class implements ModalInteractionHandler {
    regex = /^wh:add$/
    async run(interaction: ModalSubmitInteraction<'cached'>) {
        const duration = interaction.fields.getTextInputValue('duration')
        const until = interaction.fields.getTextInputValue('until')

        // Ambos campos son opcionales, pero al menos uno debe contener valor.
        if (!duration && !until) {
            await interaction.reply({
                content: 'Debes completar al menos uno de los campos.',
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        try {
            const reference = until || duration
            const { until: untilDate } = parseUserTime(reference)
            if (untilDate.toMillis() <= DateTime.utc().toMillis()) {
                await interaction.reply({
                    content:
                        'La fecha indicada ya pasó. Por favor ingresa un valor en el futuro.',
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            inactivityService.markInactivity(
                interaction.guildId,
                interaction.member,
                untilDate.toJSDate(),
                interaction.customId,
            )
            // Respuesta privada para evitar spam en el canal de interacción.
            await interaction.reply({
                content: `Registramos tu inactividad hasta ${formatForUser(untilDate.toJSDate())}.`,
                flags: MessageFlags.Ephemeral,
            })
        } catch (error) {
            await interaction.reply({
                content: (error as Error).message,
                flags: MessageFlags.Ephemeral,
            })
        }
    }
}
