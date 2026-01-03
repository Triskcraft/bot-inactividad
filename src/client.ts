import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { envs } from './config.ts'
import { registerCommands } from './interactions/commands.ts'
import { logger } from './logger.ts'

// async function bootstrap() {
const client = new Client<true>({
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
const ready = new Promise<true>(res =>
    client.once(Events.ClientReady, async client => {
        logger.info({ tag: client.user.tag }, 'Bot conectado')
        res(true)
    }),
)
client.on(Events.Error, error =>
    logger.error({ err: error }, 'Discord.js error'),
)
client.on(Events.ShardError, error =>
    logger.error({ err: error }, 'Shard error'),
)

if (envs.DEPLOY_COMMAND) {
    await registerCommands()
} else {
    logger.info('Saltando el despliegue de comandos')
}
await client.login(envs.token)
await ready // ensures ready

export { client, ready }
// }

// bootstrap().catch((error) => {
//   logger.fatal({ err: error }, 'No se pudo iniciar el bot');
//   process.exit(1);
// });
