import { logger } from '#logger'
import {
    minecraftMembersCache,
    updateMinecraftMembersCache,
} from '../members.cache.ts'
import { envs } from '#config'
import { db } from '#database'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let interval: NodeJS.Timeout

export async function startDigsService() {
    logger.info('Inicializando Digs Service')
    // Initialize cahce
    if (minecraftMembersCache.size === 0) await updateMinecraftMembersCache()
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
    for (const { uuid } of minecraftMembersCache.values()) {
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

            await db.minecraftUser.update({
                where: { uuid },
                data: { digs },
            })
        } catch (error) {
            console.log(error)
        }
    }
    logger.info(`[DIGS SERVICE] Updated digs`)
}

export function stopDigsService() {
    clearInterval(interval)
}
