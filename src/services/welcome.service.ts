import { Events, GuildMember } from 'discord.js'
import { client } from '#/client.ts'
import { logger } from '#/logger.ts'

async function handleRankUpdate(member: GuildMember) {
    console.log(member)
}

export async function initializeRankService() {
    logger.info('[WELCOME SERVICE] Inicializando')
    // Register event listener
    client.on(Events.GuildMemberAdd, handleRankUpdate)
}

export function unregisterRankService() {
    client.off(Events.GuildMemberAdd, handleRankUpdate)
}
