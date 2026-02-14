import { client } from '#client'
import { envs } from '#config'
import { db } from '#database'
import { Router } from 'express'
import { getRank } from '../../../utils/roles.ts'
import z from 'zod'

const router = Router()

const reqSchema = z.object({
    nickname: z.string().min(1, 'El nombre de usuario es obligatorio'),
    code: z.string().min(1, 'El código es obligatorio'),
})

router.post('/', async (req, res) => {
    let jsonbody: unknown
    try {
        jsonbody = JSON.parse(req.body.toString('utf-8'))
    } catch {
        return res.status(400).send('Invalid JSON')
    }
    const parsedBody = reqSchema.safeParse(jsonbody)
    if (!parsedBody.success) {
        return res.status(400).json({
            error: 'Invalid payload',
            details: z.treeifyError(parsedBody.error),
        })
    }

    const {
        data: { code, nickname },
    } = parsedBody

    const codedb = await db.linkCode.findUnique({
        where: { code },
    })

    if (!codedb) {
        return res.status(404).send({ error: 'Código no encontrado' })
    }

    const discordMember = await client.guilds.cache
        .get(envs.guildId)!
        .members.fetch(codedb.discord_id)

    if (!discordMember) {
        return res.status(400).send({ error: 'discord_id no encontrado' })
    }
    const uuid = await nicknameToUUID(nickname)
    if (!uuid) {
        return res.status(400).send({ error: 'nickname no encontrado' })
    }

    try {
        const [user] = await db.$transaction([
            db.minecraftUser.upsert({
                where: { uuid: codedb.id },
                create: {
                    nickname,
                    uuid,
                    discord_user: {
                        connect: { id: codedb.discord_id },
                    },
                    rank: getRank([...discordMember.roles.cache.values()]),
                },
                update: {
                    discord_user: {
                        connect: { id: codedb.discord_id },
                    },
                    rank: getRank([...discordMember.roles.cache.values()]),
                    nickname,
                },
                select: {
                    uuid: true,
                    nickname: true,
                    rank: true,
                    discord_user: {
                        select: {
                            id: true,
                            username: true,
                        },
                    },
                },
            }),
            db.linkCode.delete({
                where: { code },
            }),
        ])

        if (!user) {
            return res
                .status(500)
                .send({ error: 'Error al vincular la cuenta' })
        }

        res.status(200).json(user)
    } catch {
        return res.status(500).send({ error: 'Error al vincular la cuenta' })
    }
})

export default router

async function nicknameToUUID(nickname: string) {
    const req = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${nickname}`,
    )
    if (req.status !== 200) return null
    const { id } = (await req.json()) as {
        id: string
        name: string
    }
    return id
}
