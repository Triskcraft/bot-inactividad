import { db } from '#database'
import { Router } from 'express'
import { PrismaClientKnownRequestError } from '../../../prisma/generated/internal/prismaNamespace.ts'
import z from 'zod'
import { logger } from '#logger'

const router = Router()

const reqSchema = z.array(
    z.union([
        z.object({
            nickname: z.string().min(1, 'El nombre de usuario es obligatorio'),
            uuid: z
                .string()
                .min(1, 'El id de usuario es obligatorio')
                .optional(),
            digs: z.number().min(1, 'La cantidad de digs debe ser al menos 1'),
        }),
        z.object({
            nickname: z
                .string()
                .min(1, 'El nombre de usuario es obligatorio')
                .optional(),
            uuid: z.string().min(1, 'El id de usuario es obligatorio'),
            digs: z.number().min(1, 'La cantidad de digs debe ser al menos 1'),
        }),
    ]),
)

router.post('/', async (req, res) => {
    console.log(req.body.toString('utf-8'))
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
    const { data: body } = parsedBody

    const updated: { nickname: string; uuid: string; digs: number }[] = []
    for (const entry of body) {
        try {
            const newuser = await db.minecraftUser.update({
                where:
                    entry.uuid ?
                        {
                            uuid: entry.uuid,
                        }
                    :   {
                            nickname: entry.nickname!,
                        },
                data: {
                    digs: entry.digs,
                },
            })
            updated.push({
                digs: newuser.digs,
                nickname: newuser.nickname,
                uuid: newuser.uuid,
            })
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                if (error.code !== 'P2025') {
                    logger.error(error, 'Error updating digs')
                    return res
                        .status(500)
                        .json({ error: 'Internal server error' })
                }
            } else {
                logger.error(error, 'Error updating digs')
                return res.status(500).json({ error: 'Internal server error' })
            }
        }
    }
    res.json(updated)
})

export default router
