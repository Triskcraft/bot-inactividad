import { db } from '#database'
import { Collection } from 'discord.js'
import { getMinecraftMembersCache } from '../members.cache.ts'
import { MinecraftMember } from './minecraft-member.ts'
import { MinecraftRole } from './minecraft-role.ts'

export class MinecraftRolesManager {
    async fetch() {
        const roles = await db.role.findMany({
            include: {
                linked_roles: {
                    include: {
                        minecraft_user: true,
                    },
                },
            },
        })
        const members = getMinecraftMembersCache()
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
                                            l.minecraft_user.discord_user_id,
                                        nickname:
                                            l.minecraft_user.discord_user_id,
                                        uuid: l.mc_user_uuid,
                                        rank: l.minecraft_user.rank,
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
