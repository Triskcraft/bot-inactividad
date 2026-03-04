import { db } from '#/prisma/database.ts'
import { Collection } from 'discord.js'
import { MinecraftMember } from '#/classes/minecraft-member.ts'

export class MinecraftMembersManager {
    async fetch() {
        const members = await db.minecraftPlayer.findMany({
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
                    nickname: m.nickname,
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
