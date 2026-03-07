import { db } from '#/prisma/database.ts'
import { inspect } from 'node:util'
import { logger } from '#/logger.ts'
import { envs } from '#/config.ts'
import { MinecraftMember } from '#/classes/minecraft-member.ts'
import { Collection } from 'discord.js'
import { membersMannager } from '#/members.cache.ts'
import { PrismaClientKnownRequestError } from '#/prisma/generated/internal/prismaNamespace.ts'

type UUID = string
export class MinecraftRole {
    #id: string

    get id() {
        return this.#id
    }

    #name: string

    get name() {
        return this.#name
    }

    #players: Collection<UUID, MinecraftMember>

    get players() {
        return this.#players
    }

    constructor({
        id,
        name,
        players = new Collection(),
    }: {
        id: string
        name: string
        players?: Collection<UUID, MinecraftMember>
    }) {
        this.#id = id
        this.#name = name
        this.#players = players
    }

    toJSON() {
        return { id: this.#id, name: this.#name, players: this.#players }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async editName(name: string) {
        const { linked_roles } = await db.role.update({
            data: { name },
            where: { id: this.#id },
            select: {
                linked_roles: {
                    select: {
                        minecraft_player: true,
                    },
                },
            },
        })
        logger.info(`[ROLE SERVICE] Rol ${this.#name} renombrado a ${name}`)
        for (const { minecraft_player } of linked_roles) {
            this.#players.getOrInsert(
                minecraft_player.uuid,
                membersMannager.cache.getOrInsert(
                    minecraft_player.uuid,
                    new MinecraftMember({
                        discord_user_id: minecraft_player.discord_user_id,
                        nickname: minecraft_player.nickname,
                        uuid: minecraft_player.uuid,
                        rank: minecraft_player.rank,
                    }),
                ),
            )
        }
        if (this.#id === envs.DEFAULT_ROLE_ID) {
            envs.DEFAULT_ROLE_NAME = name
        }
        this.#name = name
        return this
    }

    async removePlayer(uuid: string) {
        try {
            const response = await db.linkedRole.delete({
                where: {
                    mc_user_uuid_role_id: {
                        mc_user_uuid: uuid,
                        role_id: this.#id,
                    },
                },
                select: {
                    minecraft_player: {
                        select: {
                            nickname: true,
                        },
                    },
                },
            })
            this.#players.delete(uuid)
            logger.info(
                `[ROLE SERVICE] Rol ${this.#name} desvinculado de ${response.minecraft_player.nickname}`,
            )
        } catch (error) {
            logger.error(error, '[ROLE SERVICE] Error desvinculando un rol')
        }
    }

    async addPlayer(uuid: string) {
        try {
            const {
                minecraft_player: { discord_user_id, nickname, rank },
            } = await db.linkedRole.create({
                data: {
                    role: {
                        connect: {
                            id: this.#id,
                        },
                    },
                    minecraft_player: {
                        connect: {
                            uuid: uuid,
                        },
                    },
                },
                select: {
                    minecraft_player: true,
                },
            })
            const newMember = new MinecraftMember({
                discord_user_id,
                nickname,
                uuid,
                rank,
            })
            this.#players.set(uuid, newMember)
            membersMannager.cache.set(uuid, newMember)
            logger.info(
                `[ROLE SERVICE] Rol ${this.#name} agregado a ${nickname}`,
            )
        } catch (e) {
            if (
                e instanceof PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                await this.fetch()
            } else {
                logger.error(
                    e,
                    `[ROLE SERVICE] Error al intentar agregar el rol ${this.#name} a ${uuid}`,
                )
            }
        }
    }

    async fetch() {
        const role = await db.role.findUnique({
            where: { id: this.#id },
            include: {
                linked_roles: {
                    include: {
                        minecraft_player: true,
                    },
                },
            },
        })
        if (!role) return null
        this.#id = role.id
        this.#name = role.name

        for (const {
            discord_user_id,
            nickname,
            uuid,
            rank,
        } of role.linked_roles.map(l => l.minecraft_player)) {
            this.#players.getOrInsertComputed(uuid, () => {
                return new MinecraftMember({
                    discord_user_id,
                    nickname,
                    uuid,
                    rank,
                })
            })
        }
    }
}
