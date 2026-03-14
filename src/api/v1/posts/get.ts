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
            player_uuid: true,
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
            player: {
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
        created_at: p.created_at.getTime(),
        updated_at: p.updated_at.getTime(),
        player:
            p.player ?
                {
                    ...p.player,
                    uuid: p.player.uuid,
                    nickname: p.player?.nickname,
                    digs: p.player?.digs,
                    rank: p.player.rank,
                    roles: p.player.linked_roles.map(l => l.role.name),
                }
            :   null,
        post_blocks: p.post_blocks.map(p => ({
            ...p,
            timestamp: p.timestamp.getTime(),
        })),
    }))
    res.set('Cache-Control', 'public, max-age=86400')
    res.json(post_mapped)
}
