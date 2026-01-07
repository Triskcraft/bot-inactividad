import type { Request, Response } from 'express'
import { readFile } from 'fs/promises'
import { envs } from '#/config.ts'
import { db } from '#/prisma/database.ts'

type McName = string

/**
 * Endpoint que entrega el listado de miembros combinando la whitelist de
 * Minecraft con los datos complementarios almacenados en la base de datos.
 * Se aplica caching HTTP para evitar recalcular resultados en llamadas
 * repetidas.
 */
export async function getMembers(req: Request, res: Response) {
    const file = await readFile(envs.WHITELIST_ROUTE, { encoding: 'utf-8' })
    const whitelist: McName[] = JSON.parse(file)
    res.set('Cache-Control', 'public, max-age=86400')
    res.json(await pooblateUsers(whitelist))
}

interface Member {
    mc_uuid: string
    mc_name: string
    rank: string
    description: string
    digs: number
    roles: string[]
    medias: {
        type: string
        url: string
    }[]
}

/**
 * Busca la información de un usuario específico a partir del nombre
 * declarado en la whitelist y el conjunto de enlaces obtenidos desde la BD.
 */
async function getInfoUser(
    mc_name: McName,
    links: Awaited<ReturnType<typeof getLinks>>,
) {
    const link = links.find(l => l.nickname === mc_name)

    if (!link) return null

    const rank = link.discord_user.rank
    const description = link.description ?? ''
    const digs = link.digs ?? 0
    const roles = link.linked_roles.map(lr => lr.role.name) ?? ['Digger']
    const medias = link.medias.map(({ type, url }) => ({ type, url })) ?? []

    return {
        mc_uuid: link.uuid,
        mc_name: mc_name,
        rank,
        description,
        digs,
        roles,
        medias,
    } satisfies Member
}

/**
 * Combina la whitelist con los datos de la base para devolver solo los
 * usuarios que tienen información registrada y descarta entradas nulas.
 */
async function pooblateUsers(users: McName[]) {
    const links = await getLinks()
    const promises = users.map(async user => await getInfoUser(user, links))
    const list = await Promise.all(promises)
    return list.filter(Boolean) as Member[]
}

/**
 * Recupera todos los enlaces disponibles desde la base de datos, incluyendo
 * la información del usuario de Discord, roles vinculados y medios asociados.
 */
async function getLinks() {
    const link = await db.minecraftUser.findMany({
        include: {
            discord_user: true,
            linked_roles: {
                include: {
                    role: true,
                },
            },
            medias: true,
        },
    })
    return link
}
