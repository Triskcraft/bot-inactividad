try {
    process.loadEnvFile()
} catch {
    console.error('No existe .env')
}

export interface BotConfig {
    token: string
    clientId: string
    guildId: string
    inactivityChannelId: string
    adminLogChannelId: string
    reminderIntervalMinutes: number
}

/**
 * Loads bot configuration from environment variables.
 */
export function loadConfig() {
    const required = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'DISCORD_INACTIVITY_CHANNEL_ID',
        'DISCORD_ADMIN_LOG_CHANNEL_ID',
        'WHITELIST_ROUTE',
    ]

    const recomended = [
        'DEPLOY_COMMAND',
        'DEPLOY_INACTIVITY_PANEL',
        'API_PORT',
        'NODE_ENV',
    ]

    const requiredMissing = required.filter(key => !process.env[key])
    if (requiredMissing.length > 0) {
        throw new Error(
            `Faltan variables de entorno: ${requiredMissing.join(', ')}`,
        )
    }

    const recommendedMissing = recomended.filter(key => !process.env[key])
    if (recommendedMissing.length > 0) {
        console.warn(
            `Variables de entorno recomendadas establecidas a un valor por defecto\nSe recomienda establecer las siguientes variables: ${recommendedMissing.toLocaleString(
                'es-MX',
            )}`,
        )
    }

    const {
        API_PORT = '3000',
        WHITELIST_ROUTE = '',
        DEPLOY_COMMAND = false,
        NODE_ENV = 'development',
        DEPLOY_INACTIVITY_PANEL = false,
    } = process.env

    return {
        token: process.env.DISCORD_TOKEN!,
        clientId: process.env.DISCORD_CLIENT_ID!,
        guildId: process.env.DISCORD_GUILD_ID!,
        inactivityChannelId: process.env.DISCORD_INACTIVITY_CHANNEL_ID!,
        adminLogChannelId: process.env.DISCORD_ADMIN_LOG_CHANNEL_ID!,
        reminderIntervalMinutes: Number.parseInt(
            process.env.REMINDER_INTERVAL_MINUTES ?? '5',
            10,
        ),
        API_PORT,
        WHITELIST_ROUTE,
        DEPLOY_COMMAND: DEPLOY_COMMAND === 'true',
        DEPLOY_INACTIVITY_PANEL: DEPLOY_INACTIVITY_PANEL === 'true',
        NODE_ENV,
    }
}

export const envs = loadConfig()

export const RANK_ROLES: Readonly<string[]> = [
    '1202733002195734538', // owner
    '1237979602153115728', // admin
    '1355617895480164472', // staff
    '1453448897136427251', // dev
    '1202775128006459453', // miembro
    '1202775706912948264', // member test
]
