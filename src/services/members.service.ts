import { logger } from '#/logger.ts'
import { MinecraftMembersManager } from '#/classes/minecraft-members-manager.ts'

const membersMannager = new MinecraftMembersManager()
await membersMannager.fetch()

class MembersService {
    #members = membersMannager

    get members() {
        return this.#members
    }

    async start() {
        logger.info('[MEMBERS SERVICE] Inicializando...')
    }
}

export const membersService = new MembersService()
