import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadConfig } from './config.js';
import { InactivityService } from './services/inactivityService.js';
import { RoleService } from './services/roleService.js';
import { Scheduler } from './services/scheduler.js';
import { registerCommands } from './interactions/commands.js';
import { registerInteractionHandlers } from './handlers/interactionHandler.js';
import { logger } from './logger.js';
import { db } from './prisma/database.js';

async function bootstrap() {
  const config = loadConfig();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.GuildMember, Partials.Message, Partials.Channel, Partials.Reaction],
  });

  const inactivityService = new InactivityService();
  const roleService = new RoleService();
  const scheduler = new Scheduler(inactivityService, roleService, client, config);

  registerInteractionHandlers({ client, inactivityService, roleService, config });

  client.once('ready', async (client) => {
    logger.info({ tag: client.user.tag }, 'Bot conectado');
    scheduler.start();
  });

  client.on('error', (error) => logger.error({ err: error }, 'Discord.js error'));
  client.on('shardError', (error) => logger.error({ err: error }, 'Shard error'));

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Cerrando bot');
    scheduler.stop();
    await client.destroy();
    db.$disconnect();
    process.exit(0);
  }

  await registerCommands(config);
  await client.login(config.token);
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'No se pudo iniciar el bot');
  process.exit(1);
});
