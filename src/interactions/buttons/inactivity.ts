import { MessageFlags, type ButtonInteraction } from 'discord.js'
import { buildInactivityModal } from '../../interactions/inactivityPanel.ts'
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
