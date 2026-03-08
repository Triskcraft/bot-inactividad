import { logger } from '#/logger.ts'
import { envs } from '#/config.ts'
import { db } from '#/prisma/database.ts'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PLAYER_STATUS } from '#/prisma/generated/enums.ts'
import { playersService } from './members.service.ts'
import { PrismaClientKnownRequestError } from '#/prisma/generated/internal/prismaNamespace.ts'

let interval: NodeJS.Timeout

export async function startDigsService() {
    logger.info('Inicializando Digs Service')
    // Initialize cahce
    updateDigs()
    interval = setInterval(updateDigs, 3_600_000) // 1 hour
}

type MinecraftStatsJson = {
    stats: {
        'minecraft:mined': Record<string, number>
        // and others ...
    }
    DataVersion: number
}

async function updateDigs() {
    for (const { uuid } of playersService.players.cache.values()) {
        try {
            const {
                default: { stats },
            } = (await import(
                pathToFileURL(join(envs.DIGS_STATS_DIR, `${uuid}.json`)).href,
                { with: { type: 'json' } }
            )) as { default: MinecraftStatsJson }

            const digs = Object.values(stats['minecraft:mined']).reduce(
                (a, b) => a + b,
                0,
            )

            await db.minecraftPlayer.update({
                where: { uuid, status: PLAYER_STATUS.ACTIVE },
                data: { digs },
            })
        } catch (error) {
            if (
                error instanceof PrismaClientKnownRequestError &&
                error.code !== 'P2025'
            ) {
                logger.error(error)
            }
        }
    }
    logger.info(`[DIGS SERVICE] Updated digs`)
}

export function stopDigsService() {
    clearInterval(interval)
}
