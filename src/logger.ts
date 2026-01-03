import pino from 'pino'
import { envs } from './config.ts'

const pinoConfig: Parameters<typeof pino>[0] = {
    level: process.env.LOG_LEVEL ?? 'info',
}

if (envs.NODE_ENV === 'development') {
    pinoConfig.transport = {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
    }
}

export const logger = pino(pinoConfig)
