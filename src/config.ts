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
 * Carga la configuración del bot desde variables de entorno y valida que las
 * mínimas requeridas estén presentes antes de continuar con la ejecución.
 */
export function loadConfig() {
    const required = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'DISCORD_INACTIVITY_CHANNEL_ID',
        'DISCORD_ADMIN_LOG_CHANNEL_ID',
        'WHITELIST_ROUTE',
        'PANEL_CHANNEL_ID',
        'ENCRYPT_KEY',
        'JWT_SECRERT',
        'DIGS_STATS_DIR',
    ]

    const recomended = [
        'DEPLOY_COMMAND',
        'DEPLOY_INACTIVITY_PANEL',
        'API_PORT',
        'NODE_ENV',
    ]

    const {
        API_PORT = '3000',
        WHITELIST_ROUTE = '',
        DEPLOY_COMMAND = false,
        NODE_ENV = 'development',
        DEPLOY_INACTIVITY_PANEL = false,
        PANEL_CHANNEL_ID = '',
        ENCRYPT_KEY = '',
        JWT_SECRERT = '',
        DIGS_STATS_DIR = '',
    } = process.env

    const recommendedMissing = recomended.filter(key => !process.env[key])
    if (recommendedMissing.length > 0) {
        console.warn(
            `Variables de entorno recomendadas establecidas a un valor por defecto\nSe recomienda establecer las siguientes variables:`,
        )
        for (const key of recommendedMissing) {
            console.log(`${key}="${eval(key)}"`)
        }
    }

    const requiredMissing = required.filter(key => !process.env[key])
    if (requiredMissing.length > 0) {
        throw new Error(
            `Faltan variables de entorno:\n${requiredMissing.join('=""\n')}`,
        )
    }

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
        PANEL_CHANNEL_ID,
        ENCRYPT_KEY: Buffer.from(ENCRYPT_KEY, 'base64'),
        JWT_SECRERT: new TextEncoder().encode(JWT_SECRERT),
        DIGS_STATS_DIR,
    }
}

export const envs = loadConfig()

/**
 * Lista ordenada de roles de rango. El orden determina prioridad cuando se
 * busca la jerarquía más alta que posee un usuario.
 */
export const RANK_ROLES: Readonly<string[]> = [
    '1202733002195734538', // owner
    '1237979602153115728', // admin
    '1355617895480164472', // staff
    '1453448897136427251', // dev
    '1202775128006459453', // miembro
    '1202775706912948264', // member test
]

export const WEBHOOK_PERMISSIONS = {
    DIGS: 'digs',
    LINK: 'link',
} as const

export type WebhookPermission =
    (typeof WEBHOOK_PERMISSIONS)[keyof typeof WEBHOOK_PERMISSIONS]
