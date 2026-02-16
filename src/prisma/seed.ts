import { envs } from '#config'
import { db } from '#database'
import { logger } from '#logger'
import { PrismaClientKnownRequestError } from './generated/internal/prismaNamespace.ts'

try {
    const defaultRole = await db.role.create({
        data: {
            name: envs.DEFAULT_ROLE_NAME,
        },
    })

    logger.info(defaultRole, 'Default role creado')
} catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            const defaultRole = await db.role.findUnique({
                where: {
                    name: envs.DEFAULT_ROLE_NAME,
                },
            })
            logger.info(defaultRole, 'Default role existente')
        }
    }
}
logger.info('Por favor actualize el DEFAULT_ROLE_ID en .env')
