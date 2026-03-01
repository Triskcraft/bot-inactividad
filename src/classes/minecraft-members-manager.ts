import { db } from '#database'
import { Collection } from 'discord.js'
import { MinecraftMember } from './minecraft-member.ts'

export class MinecraftMembersManager {
    async fetch() {
        const members = await db.minecraftUser.findMany({
            select: {
                uuid: true,
                nickname: true,
                discord_user_id: true,
                rank: true,
            },
        })
        for (const m of members) {
            this.#cache.set(
                m.uuid,
                new MinecraftMember({
                    discord_user_id: m.discord_user_id,
                    nickname: m.discord_user_id,
                    uuid: m.uuid,
                    rank: m.rank,
                }),
            )
        }
        return this.#cache
    }

    #cache = new Collection<string, MinecraftMember>()

    get cache() {
        return this.#cache
    }
}
