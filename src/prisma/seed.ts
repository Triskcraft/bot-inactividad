import { envs } from '#/config.ts'
import { db } from '#/prisma/database.ts'
import { logger } from '#/logger.ts'
import { PrismaClientKnownRequestError } from '#/prisma/generated/internal/prismaNamespace.ts'

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
