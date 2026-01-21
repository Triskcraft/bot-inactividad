import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { envs } from './config.ts'
import { registerCommands } from './interactions/commands.ts'
import { logger } from '#logger'

/**
 * Configuración del cliente de Discord. Se habilitan los intents y partials
 * necesarios para escuchar eventos de miembros, mensajes y reacciones aun
 * cuando la información llegue incompleta desde la pasarela de Discord.
 */
const bot = new Client<true>({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.GuildMember,
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
})

bot.on(Events.Error, error => logger.error({ err: error }, 'Discord.js error'))
bot.on(Events.ShardError, error => logger.error({ err: error }, 'Shard error'))

/**
 * El despliegue de comandos solo se ejecuta cuando la variable de entorno
 * correspondiente lo indica, evitando registrar comandos en cada arranque
 * durante entornos de desarrollo.
 */
if (envs.DEPLOY_COMMAND) {
    await registerCommands()
} else {
    logger.info('Saltando el despliegue de comandos')
}

/**
 * Promesa que se resuelve cuando Discord notifica que el bot está listo.
 * Permite encadenar tareas de arranque que dependan del estado conectado.
 */
export const client = await new Promise<Client<true>>(res => {
    bot.once(Events.ClientReady, async client => {
        logger.info({ tag: client.user.tag }, 'Bot conectado')
        res(client)
    })
    bot.login(envs.token)
})
