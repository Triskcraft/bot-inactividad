import { ButtonInteraction } from 'discord.js'
import { buttonsCache } from '../cache/interactions.ts'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ButtonInteractionHandler } from '../interactions/class.ts'

export async function loadButtons() {
    const dir = join(process.cwd(), 'src', 'buttons')

    for (const filename of await readdir(dir)) {
        const filePath = pathToFileURL(join(dir, filename)).href

        const { default: Handler } = (await import(filePath)) as {
            default: { new (): ButtonInteractionHandler }
        }

        buttonsCache.add(new Handler())
    }
}

/**
 * Manejador central de botones del panel de inactividad. Cada botón ejecuta
 * una acción distinta: crear/editar, limpiar o mostrar el estado del usuario.
 */
export async function handleButton(interaction: ButtonInteraction) {
    if (!interaction.inCachedGuild()) return

    for (const handler of buttonsCache) {
        if (handler.regex.exec(interaction.customId)) {
            await handler.run(interaction)
        }
    }
}
