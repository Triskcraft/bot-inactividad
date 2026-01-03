import pino from 'pino'

const pinoConfig =
    process.env.NODE_ENV === 'development' ?
        {
            level: process.env.LOG_LEVEL ?? 'info',
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
            },
        }
    :   {
            level: process.env.LOG_LEVEL ?? 'info',
        }

export const logger = pino(pinoConfig)
