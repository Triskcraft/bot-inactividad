import { db } from '#/prisma/database.ts'
import { Collection } from 'discord.js'
import { MinecraftMember } from '#/classes/minecraft-member.ts'
import { MinecraftRole } from '#/classes/minecraft-role.ts'
import { membersMannager } from '#/members.cache.ts'

export class MinecraftRolesManager {
    async fetch() {
        const roles = await db.role.findMany({
            include: {
                linked_roles: {
                    include: {
                        minecraft_player: true,
                    },
                },
            },
        })
        const members = membersMannager.cache
        for (const r of roles) {
            this.#cache.set(
                r.id,
                new MinecraftRole({
                    id: r.id,
                    name: r.name,
                    players: new Collection(
                        r.linked_roles.map(l => {
                            return [
                                l.mc_user_uuid,
                                members.getOrInsert(
                                    l.mc_user_uuid,
                                    new MinecraftMember({
                                        discord_user_id:
                                            l.minecraft_player.discord_user_id,
                                        nickname: l.minecraft_player.nickname,
                                        uuid: l.mc_user_uuid,
                                        rank: l.minecraft_player.rank,
                                    }),
                                ),
                            ]
                        }),
                    ),
                }),
            )
        }
        return this.#cache
    }

    #cache = new Collection<string, MinecraftRole>()

    get cache() {
        return this.#cache
    }

    async create(name: string) {
        const role = new MinecraftRole(
            await db.role.create({
                data: { name },
            }),
        )
        this.#cache.set(role.id, role)
        return role
    }

    async delete(id: string) {
        await db.role.delete({
            where: { id },
        })
        this.#cache.delete(id)
    }
}
