import { Events, GuildMember, type PartialGuildMember } from 'discord.js'
import { client } from '#/client.ts'
import { getRank } from '#/utils/roles.ts'
import { envs } from '#/config.ts'
import { logger } from '#/logger.ts'
import {
    getMinecraftMembersCache,
    updateMinecraftMembersCache,
    type MinecraftMemberCached,
} from '#/members.cache.ts'

async function checkRanks(member: GuildMember, cached: MinecraftMemberCached) {
    const currentRank = getRank([...member.roles.cache.values()])
    if (cached.rank !== currentRank) {
        await cached.setRank(currentRank)
        logger.info(
            `[RANK SERVICE] Updated rank for ${cached.nickname} to ${currentRank}`,
        )
    }
}

async function handleRankUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
) {
    const minecraftLinked = getMinecraftMembersCache()
        .values()
        .find(m => m.discord_user_id === oldMember.id)
    if (minecraftLinked) {
        checkRanks(newMember, minecraftLinked)
    }
}

export async function initializeRankService() {
    logger.info('[RANK SERVICE] Inicializando')
    // Initialize cahce
    await updateMinecraftMembersCache()
    // Register event listener
    client.on(Events.GuildMemberUpdate, handleRankUpdate)
    // check all members on startup
    for (const cached of getMinecraftMembersCache().values()) {
        const member = await client.guilds.cache
            .get(envs.guildId)!
            .members.fetch(cached.discord_user_id)
            .catch(() => null)
        if (!member) continue
        checkRanks(member, cached)
    }
}

export function unregisterRankService() {
    client.off(Events.GuildMemberUpdate, handleRankUpdate)
}
