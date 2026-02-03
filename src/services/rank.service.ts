import { Events, GuildMember, type PartialGuildMember } from 'discord.js'
import { client } from '../client.ts'
import { db } from '#database'
import { getRank } from '../utils/roles.ts'
import { envs } from '#config'
import { logger } from '#logger'

async function getMembersToCache() {
    const members = await db.minecraftUser.findMany({
        select: {
            uuid: true,
            nickname: true,
            discord_user_id: true,
            rank: true,
        },
    })
    return members
}

type UUID = string
type MinecraftMemberCached = Awaited<
    ReturnType<typeof getMembersToCache>
>[number]
export const minecraftMembersCache = new Map<UUID, MinecraftMemberCached>()

export async function updateMinecraftMembersCache() {
    const members = await getMembersToCache()
    minecraftMembersCache.clear()
    for (const member of members) {
        minecraftMembersCache.set(member.uuid, member)
    }
    return minecraftMembersCache
}

async function checkRanks(member: GuildMember, cached: MinecraftMemberCached) {
    const currentRank = getRank([...member.roles.cache.values()])
    if (cached.rank !== currentRank) {
        // update in db
        db.minecraftUser
            .update({
                where: { uuid: cached.uuid },
                data: { rank: currentRank },
            })
            .then(() => {
                // update in cache
                minecraftMembersCache.set(cached.uuid, {
                    ...cached,
                    rank: currentRank,
                })
                logger.info(
                    `[RANK SERVICE] Updated rank for ${cached.nickname} to ${currentRank}`,
                )
            })
    }
}

async function handleRankUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
) {
    const minecraftLinked = minecraftMembersCache
        .values()
        .find(m => m.discord_user_id === oldMember.id)
    if (minecraftLinked) {
        checkRanks(newMember, minecraftLinked)
    }
}

export async function initializeRankService() {
    logger.info('Inicializando Rank Service')
    // Initialize cahce
    await updateMinecraftMembersCache()
    // Register event listener
    client.on(Events.GuildMemberUpdate, handleRankUpdate)
    // check all members on startup
    for (const cached of minecraftMembersCache.values()) {
        const member = await client.guilds.cache
            .get(envs.guildId)!
            .members.fetch(cached.discord_user_id)
        if (!member) continue
        checkRanks(member, cached)
    }
}

export function unregisterRankService() {
    client.off(Events.GuildMemberUpdate, handleRankUpdate)
}
