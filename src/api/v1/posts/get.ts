import type { Request, Response } from 'express'
import { db } from '#/prisma/database.ts'
import { POST_STATUS } from '#/prisma/generated/enums.ts'

/**
 * Endpoint que entrega el listado de post disponibles para el blog
 * Se aplica caching HTTP para evitar recalcular resultados en llamadas
 * repetidas.
 */

export async function getPosts(req: Request, res: Response) {
    const posts = await db.post.findMany({
        where: {
            status: {
                not: POST_STATUS.DRAFT,
            },
        },
        omit: {
            thread_id: true,
            discord_user_id: true,
            minecraft_player_uuid: true,
            status: true,
        },
        include: {
            post_blocks: {
                omit: {
                    post_id: true,
                    message_id: true,
                    author_id: true,
                },
            },
            discord_user: true,
            minecraft_player: {
                select: {
                    digs: true,
                    rank: true,
                    uuid: true,
                    nickname: true,
                    linked_roles: {
                        select: {
                            role: {
                                omit: {
                                    id: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    const post_mapped = posts.map(p => ({
        ...p,
        minecraft_player:
            p.minecraft_player ?
                {
                    ...p.minecraft_player,
                    uuid: p.minecraft_player.uuid,
                    nickname: p.minecraft_player?.nickname,
                    digs: p.minecraft_player?.digs,
                    rank: p.minecraft_player.rank,
                    linked_roles: p.minecraft_player.linked_roles.map(
                        l => l.role.name,
                    ),
                }
            :   null,
    }))
    res.set('Cache-Control', 'public, max-age=86400')
    res.json(post_mapped)
}
