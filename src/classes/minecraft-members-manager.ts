import { db } from '#/prisma/database.ts'
import { Collection } from 'discord.js'
import { MinecraftMember } from '#/classes/minecraft-member.ts'
import { PLAYER_STATUS } from '#/prisma/generated/enums.ts'

export class MinecraftMembersManager {
    async fetch(): Promise<Collection<string, MinecraftMember>>
    async fetch(
        uuid: string,
        options?: { cache?: boolean },
    ): Promise<MinecraftMember | null>
    async fetch(
        uuid?: string,
        options?: { cache?: boolean },
    ): Promise<Collection<string, MinecraftMember> | MinecraftMember | null> {
        if (!uuid) {
            const members = await db.minecraftPlayer.findMany({
                where: { status: PLAYER_STATUS.ACTIVE },
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
        } else {
            let member: MinecraftMember | null = null
            if (options?.cache) {
                member = this.#cache.get(uuid) ?? null
            }
            if (member) return member
            const memberData = await db.minecraftPlayer.findFirst({
                where: { status: PLAYER_STATUS.ACTIVE, uuid },
                select: {
                    uuid: true,
                    nickname: true,
                    discord_user_id: true,
                    rank: true,
                },
            })
            if (memberData) {
                member = new MinecraftMember({
                    discord_user_id: memberData.discord_user_id,
                    nickname: memberData.nickname,
                    uuid: memberData.uuid,
                    rank: memberData.rank,
                })
                this.#cache.set(member.uuid, member)
            }
            return member
        }
    }

    #cache = new Collection<string, MinecraftMember>()

    get cache() {
        return this.#cache
    }
}
