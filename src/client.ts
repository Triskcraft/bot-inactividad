import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { envs } from '#/config.ts'
import { logger } from '#/logger.ts'
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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
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
