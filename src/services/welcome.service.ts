import { Events, GuildMember, GuildSystemChannelFlags } from 'discord.js'
import { client } from '#/client.ts'
import { logger } from '#/logger.ts'
import { envs } from '#/config.ts'

const DATA_CHANNEL = `<#1202785595278098492>`

async function handleRankUpdate(member: GuildMember) {
    await member.guild.systemChannel?.send(
        [
            `👋 ¡Hey ${member}!`,
            `Bienvenido a Triskcraft, puedes mirar ${DATA_CHANNEL} para comenzar.`,
            `Welcome to Trikcraft, check ${DATA_CHANNEL} to start.`,
        ].join('\n'),
    )
}

class WelcomeService {
    async start() {
        const guild = client.guilds.cache.get(envs.DISCORD_GUILD_ID)!
        if (
            !guild.systemChannel ||
            guild.systemChannelFlags.has(
                GuildSystemChannelFlags.SuppressJoinNotifications,
            )
        )
            return logger.info('[WELCOME SERVICE] Omitido')
        logger.info('[WELCOME SERVICE] Inicializando')

        // Register event listener
        client.on(Events.GuildMemberAdd, handleRankUpdate)
    }

    stop() {
        client.off(Events.GuildMemberAdd, handleRankUpdate)
    }
}

export const welcomeService = new WelcomeService()
