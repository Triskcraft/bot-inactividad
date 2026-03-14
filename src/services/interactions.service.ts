import { logger } from '#/logger.ts'
import { client } from '#/client.ts'
import {
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    Events,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    type ApplicationCommandDataResolvable,
} from 'discord.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CustomIdParser } from '#/utils/format.ts'
import { envs } from '#/config.ts'

export abstract class ButtonInteractionHandler<K extends string = ''> {
    regex: RegExp = /\\/
    async run(interaction: ButtonInteraction<'cached'>): Promise<unknown> {
        return await interaction.reply({
            content: 'not implemented',
            flags: MessageFlags.Ephemeral,
        })
    }
    static async build(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        params: Record<string, unknown> = {},
    ): Promise<ButtonBuilder> {
        return new ButtonBuilder()
    }
    parser(customId: string) {
        return new CustomIdParser<K>(this.regex, customId)
    }
}

export abstract class StringMenuHandler<K extends string = ''> {
    regex: RegExp = /\\/
    async run(
        interaction: StringSelectMenuInteraction<'cached'>,
    ): Promise<unknown> {
        return await interaction.reply({
            content: 'not implemented',
            flags: MessageFlags.Ephemeral,
        })
    }
    static async build(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        params: Record<string, unknown> = {},
    ): Promise<StringSelectMenuBuilder> {
        return new StringSelectMenuBuilder()
    }
    parser(customId: string) {
        return new CustomIdParser<K>(this.regex, customId)
    }
}

export abstract class ModalInteractionHandler<K extends string = ''> {
    regex: RegExp = /\\/
    async run(interaction: ModalSubmitInteraction<'cached'>): Promise<unknown> {
        return await interaction.reply({
            content: 'not implemented',
            flags: MessageFlags.Ephemeral,
        })
    }
    static async build(
        _params: Record<string, unknown> = {},
    ): Promise<ModalBuilder> {
        return new ModalBuilder()
    }
    parser(customId: string) {
        return new CustomIdParser<K>(this.regex, customId)
    }
}

export abstract class CommandInteractionHandler {
    abstract name: string
    abstract run(
        interaction: ChatInputCommandInteraction<'cached'>,
    ): Promise<unknown>
    static async build(
        _params: Record<string, unknown> = {},
    ): Promise<ApplicationCommandDataResolvable> {
        return new SlashCommandBuilder()
    }
}

class InteractionService {
    buttonsCache = new Set<ButtonInteractionHandler>()
    modalsCache = new Set<ModalInteractionHandler>()
    stringMenuCache = new Set<StringMenuHandler>()
    commandsCache = new Set<CommandInteractionHandler>()

    async registerInteractionHandlers() {
        await this.loadButtons()
        await this.loadCommands()
        await this.loadModals()
        await this.loadStringMenu()

        client.on(Events.InteractionCreate, async interaction => {
            try {
                if (interaction.isButton()) {
                    await this.handleButton(interaction)
                } else if (interaction.isModalSubmit()) {
                    await this.handleModal(interaction)
                } else if (interaction.isChatInputCommand()) {
                    await this.handleCommand(interaction)
                } else if (interaction.isStringSelectMenu()) {
                    await this.handleStringMenu(interaction)
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

    async registerCommands() {
        const commands: Array<ApplicationCommandDataResolvable> = []
        const dir = join(process.cwd(), 'src', 'interactions', 'commands')

        for (const filename of await readdir(dir)) {
            const filePath = pathToFileURL(join(dir, filename)).href

            const { default: command } = (await import(filePath)) as {
                default: typeof CommandInteractionHandler
            }

            commands.push(await command.build())
        }
        const guild = client.guilds.cache.get(envs.DISCORD_GUILD_ID)!
        await guild.commands.set(commands)
    }

    async loadButtons() {
        const dir = join(process.cwd(), 'src', 'interactions', 'buttons')

        for (const file of await readdir(dir, {
            recursive: true,
            withFileTypes: true,
        })) {
            if (!file.isFile()) continue
            const filePath = pathToFileURL(
                join(file.parentPath, file.name),
            ).href

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

        for (const file of await readdir(dir, {
            recursive: true,
            withFileTypes: true,
        })) {
            if (!file.isFile()) continue
            const filePath = pathToFileURL(
                join(file.parentPath, file.name),
            ).href

            const { default: Handler } = (await import(filePath)) as {
                default: { new (): ModalInteractionHandler }
            }

            interactionService.modalsCache.add(new Handler())
        }
    }

    async loadStringMenu() {
        const dir = join(process.cwd(), 'src', 'interactions', 'stringMenu')

        for (const filename of await readdir(dir)) {
            const filePath = pathToFileURL(join(dir, filename)).href

            const { default: Handler } = (await import(filePath)) as {
                default: { new (): StringMenuHandler }
            }

            interactionService.stringMenuCache.add(new Handler())
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

    async handleStringMenu(interaction: StringSelectMenuInteraction) {
        if (!interaction.inCachedGuild()) return
        for (const handler of interactionService.stringMenuCache) {
            if (handler.regex.exec(interaction.customId)) {
                await handler.run(interaction)
            }
        }
    }
}

export const interactionService = new InteractionService()
