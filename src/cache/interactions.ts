import type {
    ButtonInteractionHandler,
    ModalInteractionHandler,
} from '../interactions/class.ts'

export const buttonsCache = new Set<ButtonInteractionHandler>()
export const modalsCache = new Set<ModalInteractionHandler>()
