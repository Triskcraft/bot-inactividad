import { logger } from '#/logger.ts'
import { PlayersManager } from '#/classes/players-manager.ts'
import { client } from '#/client.ts'
import { Events } from 'discord.js'
import { envs } from '#/config.ts'

/**
 * Servicio para el manejo de jugadores en el gremio.
 * majena la información de los jugadores y escucha el evento de baneos para removerlos.
 */
class PlayersService {
    #players = new PlayersManager()

    get players() {
        return this.#players
    }

    async start() {
        logger.info('[PLAYERS SERVICE] Inicializando...')
        await this.#players.fetch()
        this.#installEventListener()
    }

    /**
     * Instala el event listener.
     */
    #installEventListener() {
        client.on(Events.GuildBanAdd, async ban => {
            if (ban.guild.id !== envs.DISCORD_GUILD_ID) return
            const player = this.#players.cache.find(
                p => p.discord_user_id === ban.user.id,
            )
            if (!player) return
            await this.#players.delete(player.uuid)
        })
    }
}

const playersService = new PlayersService()
await playersService.start()

export { playersService }
