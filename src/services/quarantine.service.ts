import { client } from '#/client.ts'
import { envs } from '#/config.ts'
import { logger } from '#/logger.ts'
import { Events, Message, Role, type SendableChannels } from 'discord.js'
import imghash from 'imghash'
import { readdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileTypeFromBuffer } from 'file-type'
import leven from 'leven'

export type ScamImageRoute = string
export type ScamImageHash = string
class QuarentineService {
    #role: Role | null = null
    #channel: SendableChannels | null = null
    #scamImgHash = new Map<ScamImageRoute, ScamImageHash>()
    #tmpRoute = ''

    get role() {
        return this.#role
    }

    get channel() {
        return this.#channel
    }

    async start() {
        logger.info('[QUARENTINE SERVICE] Inicializando...')
        await this.#checkRole()
        if (!this.#role) return
        await this.#checkChannel()
        if (!this.#channel) return
        await this.#createTmpDir()
        this.#installEventListener()
    }

    async #createTmpDir() {
        this.#tmpRoute = await mkdtemp(
            join(tmpdir(), 'triskbot-quarentine-service'),
        )
    }

    async #checkRole() {
        this.#role =
            (await client.guilds.cache
                .get(envs.DISCORD_GUILD_ID)
                ?.roles.fetch(envs.BLOG_ROLE_ID)
                .catch(() => null)) ?? null
        if (!this.#role) {
            logger.error(
                `[QUARENTINE SERVICE] El rol ${envs.BLOG_ROLE_ID} no se encuentra disponible, se omitirá la inicialización`,
            )
        }
    }

    async getScamImageHash() {
        if (this.#scamImgHash.size) {
            return this.#scamImgHash
        }
        const scamImgDir = await readdir(
            join(process.cwd(), 'src', 'img', 'scam'),
        )
        for (const imgRoute of scamImgDir) {
            this.#scamImgHash.set(imgRoute, await imghash.hash(imgRoute))
        }
        return this.#scamImgHash
    }

    async #checkChannel() {
        const channel =
            client.channels.cache.get(envs.BLOG_CHANNEL_ID) ??
            (await client.channels.fetch(envs.BLOG_CHANNEL_ID))

        if (!channel) {
            return logger.warn(
                '[QUARENTINE SERVICE] Canal de blog no encontrado, se omitirá la inicialización',
            )
        }

        if (!channel.isSendable()) {
            return logger.warn(
                '[QUARENTINE SERVICE] El canal de pannel no está disponible, se omitirá la inicialización',
            )
        }

        this.#channel = channel
    }

    #installEventListener() {
        client.on(Events.MessageCreate, async message => {
            this.#imgScamCheck(message)
        })
    }

    async #imgScamCheck(message: Message) {
        if (message.inGuild()) {
            return
        }
        if (!message.attachments.size) return
        const scamImgHashesPromise = this.getScamImageHash()
        const { abort, signal } = new AbortController()
        message.attachments.forEach(async att => {
            // check
            if (!att.contentType?.includes('image')) {
                return
            }
            const req = await fetch(att.url, { signal })
            const res = await req.arrayBuffer()
            const buffer = Buffer.from(res)
            const type = await fileTypeFromBuffer(buffer)
            const route = join(
                this.#tmpRoute,
                `${message.channelId}-${message.id}-${att.id}.${type?.ext ?? 'jpg'}`,
            )
            if (signal.aborted) return
            await writeFile(route, buffer)
            const hash = await imghash.hash(route)
            const scamImgHashes = await scamImgHashesPromise
            scamImgHashes.forEach(async toCompare => {
                const distance = leven(hash, toCompare)
                if (distance > 12) return
                abort()
            })
        })
    }
}

export const quarentineService = new QuarentineService()
