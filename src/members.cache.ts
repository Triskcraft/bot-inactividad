import { db } from "#/prisma/database.ts"
import { Temporal } from '@js-temporal/polyfill'
import { MinecraftMember } from './classes/minecraft-member.ts'

const lastFetched = Temporal.Now.instant().epochMilliseconds

async function getMembersToCache() {
    const members = await db.minecraftUser.findMany({
        select: {
            uuid: true,
            nickname: true,
            discord_user_id: true,
            rank: true,
        },
    })
    return members.map(m => new MinecraftMember(m))
}

type UUID = string
export type MinecraftMemberCached = Awaited<
    ReturnType<typeof getMembersToCache>
>[number]
const minecraftMembersCache = new Map<UUID, MinecraftMemberCached>()

export async function updateMinecraftMembersCache() {
    const members = await getMembersToCache()
    for (const member of members) {
        minecraftMembersCache.set(member.uuid, member)
    }
    return minecraftMembersCache
}

export function getMinecraftMembersCache() {
    if (minecraftMembersCache.size === 0) updateMinecraftMembersCache()
    else if (lastFetched + 3_600_000 < Temporal.Now.instant().epochMilliseconds)
        updateMinecraftMembersCache()
    return minecraftMembersCache
}
