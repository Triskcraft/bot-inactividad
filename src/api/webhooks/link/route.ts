import { db } from '#database'
import { Router } from 'express'
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

    try {
        const [user] = await db.$transaction([
            db.minecraftUser.upsert({
                where: { discord_user_id: codedb.discord_id },
                create: {
                    nickname,
                    uuid: codedb.discord_id,
                    discord_user: {
                        connect: { id: codedb.discord_id },
                    },
                },
                update: {
                    discord_user: {
                        connect: { id: codedb.discord_id },
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
