import { envs } from '#config'
import { db } from '#database'
import { Temporal } from '@js-temporal/polyfill'
import { inspect } from 'node:util'

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

export class MinecraftMember {
    #uuid: string

    get uuid() {
        return this.#uuid
    }

    #nicknname: string

    get nickname() {
        return this.#nicknname
    }

    #discord_user_id: string

    get discord_user_id() {
        return this.#discord_user_id
    }

    #rank: string

    get rank() {
        return this.#rank
    }

    constructor({
        discord_user_id,
        nickname,
        uuid,
        rank = envs.DEFAULT_RANK,
    }: {
        uuid: string
        nickname: string
        discord_user_id: string
        rank?: string
    }) {
        this.#uuid = uuid
        this.#nicknname = nickname
        this.#discord_user_id = discord_user_id
        this.#rank = rank
    }

    toJSON() {
        return {
            uuid: this.#uuid,
            nicknname: this.#nicknname,
            rank: this.#rank,
            discord_user_id: this.#discord_user_id,
        }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async setRank(rank: string) {
        await db.minecraftUser.update({
            where: { uuid: this.#uuid },
            data: { rank },
        })
        this.#rank = rank
        return this
    }
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
