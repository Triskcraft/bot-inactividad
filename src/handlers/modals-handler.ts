import { type ModalSubmitInteraction } from 'discord.js'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type { ModalInteractionHandler } from '../interactions/class.ts'
import { modalsCache } from '../cache/interactions.ts'

export async function loadModals() {
    const dir = join(process.cwd(), 'src', 'modals')

    for (const filename of await readdir(dir)) {
        const filePath = pathToFileURL(join(dir, filename)).href

        const { default: Handler } = (await import(filePath)) as {
            default: { new (): ModalInteractionHandler }
        }

        modalsCache.add(new Handler())
    }
}

/**
 * Procesa los formularios enviados desde el modal de inactividad validando
 * que exista al menos un campo y que la fecha indicada sea futura.
 */
export async function handleModal(interaction: ModalSubmitInteraction) {
    if (!interaction.inCachedGuild()) return
    for (const handler of modalsCache) {
        if (handler.regex.exec(interaction.customId)) {
            await handler.run(interaction)
        }
    }
}
