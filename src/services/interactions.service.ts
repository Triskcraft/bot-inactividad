import { logger } from '#logger'
import { client } from '../client.ts'
import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    Events,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
} from 'discord.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface ButtonInteractionHandler {
    regex: RegExp
    run(interaction: ButtonInteraction<'cached'>): Promise<unknown>
}

export abstract class ModalInteractionHandler {
    regex: RegExp = /\\/
    async run(interaction: ModalSubmitInteraction<'cached'>): Promise<unknown> {
        return await interaction.reply({
            content: 'not implemented',
            flags: MessageFlags.Ephemeral,
        })
    }
    static build(): ModalBuilder {
        return new ModalBuilder()
    }
}

export interface CommandInteractionHandler {
    name: string
    run(interaction: ChatInputCommandInteraction<'cached'>): Promise<unknown>
}

class InteractionService {
    buttonsCache = new Set<ButtonInteractionHandler>()
    modalsCache = new Set<ModalInteractionHandler>()
    commandsCache = new Set<CommandInteractionHandler>()

    async registerInteractionHandlers() {
        await this.loadButtons()
        await this.loadCommands()
        await this.loadModals()

        client.on(Events.InteractionCreate, async interaction => {
            try {
                if (interaction.isButton()) {
                    await this.handleButton(interaction)
                } else if (interaction.isModalSubmit()) {
                    await this.handleModal(interaction)
                } else if (interaction.isChatInputCommand()) {
                    await this.handleCommand(interaction)
                }
            } catch (error) {
                logger.error(
                    { err: error, interaction: interaction.id },
                    'Error procesando interacción',
                )
                if (interaction.isRepliable()) {
                    const replyContent =
                        'Ocurrió un error inesperado al procesar tu solicitud.'
                    const ephemeral = !(
                        interaction.isChatInputCommand() &&
                        interaction.commandName === 'inactividad'
                    )
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({
                            content: replyContent,
                            ephemeral,
                        })
                    } else {
                        await interaction.reply({
                            content: replyContent,
                            ephemeral,
                        })
                    }
                }
            }
        })
    }

    async loadButtons() {
        const dir = join(process.cwd(), 'src', 'interactions', 'buttons')

        for (const filename of await readdir(dir)) {
            const filePath = pathToFileURL(join(dir, filename)).href

            const { default: Handler } = (await import(filePath)) as {
                default: { new (): ButtonInteractionHandler }
            }

            interactionService.buttonsCache.add(new Handler())
        }
    }

    async handleButton(interaction: ButtonInteraction) {
        if (!interaction.inCachedGuild()) return

        for (const handler of interactionService.buttonsCache) {
            if (handler.regex.exec(interaction.customId)) {
                await handler.run(interaction)
            }
        }
    }

    async loadModals() {
        const dir = join(process.cwd(), 'src', 'interactions', 'modals')

        for (const filename of await readdir(dir)) {
            const filePath = pathToFileURL(join(dir, filename)).href

            const { default: Handler } = (await import(filePath)) as {
                default: { new (): ModalInteractionHandler }
            }

            interactionService.modalsCache.add(new Handler())
        }
    }

    /**
     * Procesa los formularios enviados desde el modal de inactividad validando
     * que exista al menos un campo y que la fecha indicada sea futura.
     */
    async handleModal(interaction: ModalSubmitInteraction) {
        if (!interaction.inCachedGuild()) return
        for (const handler of interactionService.modalsCache) {
            if (handler.regex.exec(interaction.customId)) {
                await handler.run(interaction)
            }
        }
    }

    async loadCommands() {
        const dir = join(process.cwd(), 'src', 'interactions', 'commands')

        for (const filename of await readdir(dir)) {
            const filePath = pathToFileURL(join(dir, filename)).href

            const { default: Handler } = (await import(filePath)) as {
                default: { new (): CommandInteractionHandler }
            }

            interactionService.commandsCache.add(new Handler())
        }
    }

    /**
     * Procesa los formularios enviados desde el modal de inactividad validando
     * que exista al menos un campo y que la fecha indicada sea futura.
     */
    async handleCommand(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return
        for (const handler of interactionService.commandsCache) {
            if (handler.name === interaction.commandName) {
                await handler.run(interaction)
            }
        }
    }
}

export const interactionService = new InteractionService()
