import { PLAYER_STATUS } from '#/db/generated/enums.ts'
import { db } from '#/db/prisma.ts'
import type { RequestHandler } from 'express'

type includesQuery = 'roles' | 'medias' | (string & {})
export const getPlayers: RequestHandler<
    { game: string },
    Member[],
    null,
    { includes: includesQuery | includesQuery[] }
> = async (req, res) => {
    const { includes } = req.query

    const includeRoles =
        typeof includes === 'string' ?
            includes === 'roles'
        :   includes.includes('roles')

    const includeMedias =
        typeof includes === 'string' ?
            includes === 'medias'
        :   includes.includes('medias')

    const roleIncludeJoin = {
        select: {
            role: {
                select: {
                    name: true,
                },
            },
        },
    } as const

    const members = await db.player.findMany({
        where: { status: PLAYER_STATUS.ACTIVE },
        include: {
            medias:
                includeMedias ?
                    {
                        select: {
                            type: true,
                            url: true,
                        },
                    }
                :   false,
            linked_roles:
                includeRoles ? roleIncludeJoin : ({} as typeof roleIncludeJoin),
        },
    })
    const pobled = members.map(
        ({
            description,
            digs,
            rank,
            linked_roles,
            medias,
            nickname: mc_name,
            uuid: mc_uuid,
        }) => {
            const member: Member = {
                description,
                digs,
                mc_name,
                mc_uuid,
                rank,
            }
            if (includeMedias) {
                member.medias = medias
            }
            if (includeRoles) {
                member.roles = linked_roles.map(lr => lr.role.name)
            }
            return member
        },
    )
    return res.json(pobled)
}

interface Member {
    mc_uuid: string
    mc_name: string
    rank: string
    description: string
    digs: number
    roles?: string[]
    medias?: {
        type: string
        url: string
    }[]
}
