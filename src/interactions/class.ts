import { ModalSubmitInteraction, type ButtonInteraction } from 'discord.js'

export interface ButtonInteractionHandler {
    regex: RegExp
    run(interaction: ButtonInteraction<'cached'>): Promise<unknown>
}

export interface ModalInteractionHandler {
    regex: RegExp
    run(interaction: ModalSubmitInteraction<'cached'>): Promise<unknown>
}
