import { client } from '#/client.ts'
import { envs } from '#/config.ts'
import { logger } from '#/logger.ts'
import {
    ActionRowBuilder,
    ButtonBuilder,
    Collection,
    ContainerBuilder,
    Events,
    Message,
    MessageFlags,
    Role,
    TextDisplayBuilder,
    type SendableChannels,
} from 'discord.js'
import imghash from 'imghash'
import { readdir, mkdtemp, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileTypeFromBuffer } from 'file-type'
import leven from 'leven'
import { db } from '#/prisma/database.ts'

export type ScamImageRoute = string
export type ScamImageHash = string
export interface ScamFeatures {
    linkCount: number
    hasTelegram: boolean
    hasZangi: boolean
    hasCallToAction: boolean
    suspiciousTone: boolean
    hasFancyUnicode: boolean
    hasMixedAlphabet: boolean
    hasNonAscii: boolean
}
export interface ScamResult {
    score: number
    isScam: boolean
    level: 'low' | 'medium' | 'high'
    reasons: string[]
}

class QuarentineService {
    #role: Role | null = null
    #channel: SendableChannels | null = null
    #scamImgHash = new Collection<ScamImageRoute, ScamImageHash>()
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
        if (!envs.QUARENTINE_ROLE_ID) {
            return logger.warn(
                `[QUARENTINE SERVICE] El env QUARENTINE_ROLE_ID no se encuentra establecido, se omitirá la inicialización`,
            )
        }
        this.#role =
            (await client.guilds.cache
                .get(envs.DISCORD_GUILD_ID)
                ?.roles.fetch(envs.QUARENTINE_ROLE_ID)
                .catch(() => null)) ?? null
        if (!this.#role) {
            logger.warn(
                `[QUARENTINE SERVICE] El rol ${envs.QUARENTINE_ROLE_ID} no se encuentra disponible, se omitirá la inicialización`,
            )
        }
    }

    async #checkChannel() {
        if (!envs.QUARENTINE_CHANNEL_ID) {
            return logger.warn(
                '[QUARENTINE SERVICE] El env QUARENTINE_CHANNEL_ID no se encuentra establecido, se omitirá la inicialización',
            )
        }
        const channel =
            client.channels.cache.get(envs.QUARENTINE_CHANNEL_ID) ??
            (await client.channels.fetch(envs.QUARENTINE_CHANNEL_ID))

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

    #installEventListener() {
        client.on(Events.MessageCreate, async message => {
            if (message.author.bot) return
            this.#imgScamCheck(message)
            this.#messageSacmCheck(message)
        })
    }

    async #imgScamCheck(message: Message): Promise<void> {
        if (!message.inGuild()) {
            return
        }
        if (!message.attachments.size) return

        // Promise for async paralelism
        const scamImgHashesPromise = this.getScamImageHash()
        const { abort, signal } = new AbortController()

        const coincidence = message.attachments.find(async att => {
            // check
            if (!att.contentType?.includes('image')) {
                return false
            }

            const req = await fetch(att.url, { signal })
            const res = await req.arrayBuffer()

            const buffer = Buffer.from(res)

            const type = await fileTypeFromBuffer(buffer)
            const route = join(
                this.#tmpRoute,
                `${message.channelId}-${message.id}-${att.id}.${type?.ext ?? 'jpg'}`,
            )

            signal.addEventListener('abort', async () => {
                // when abort the request
                // try to delete file
                // if the process
                // not finish
                QuarentineService.deleteFile(route)
            })

            if (signal.aborted) return false
            await writeFile(route, buffer)
            if (signal.aborted) return false

            const hash = await imghash.hash(route)
            const scamImgHashes = await scamImgHashesPromise

            const coincidence = scamImgHashes.find(
                async toCompare => leven(hash, toCompare) < 13,
            )

            if (!coincidence) {
                // explicit delete
                QuarentineService.deleteFile(route)
                return false
            }
            // if exist coincidence
            // abort others request
            // implicit delete
            abort()
            return true
        })

        if (!coincidence) return

        const roles =
            message.member?.roles.cache
                .mapValues(r => r.id)
                .values()
                .toArray() ?? []

        await db.isolatedUsers.create({
            data: {
                roles,
                user: {
                    connectOrCreate: {
                        create: {
                            id: message.author.id,
                            username: message.author.id,
                        },
                        where: {
                            id: message.author.id,
                        },
                    },
                },
            },
        })

        for (const role of roles) {
            await message.member?.roles.remove(role)
        }
        await message.member?.roles.add(this.role!)

        this.channel?.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            [
                                `${message.author}. Esta imagen se ha detectado como posible scam y se te ha aislado por sospecha de cuenta comprimetida.`,
                                'Si recuperaste tu cuenta o crees que es un error contacta a un administrador para cancelar tu cuarentena',
                            ].join('\n'),
                        ),
                    )
                    .addMediaGalleryComponents
                    // add image
                    ()
                    .addActionRowComponents(
                        new ActionRowBuilder<ButtonBuilder>()
                            .addComponents
                            // button to cancell
                            (),
                    ),
            ],
        })
    }

    static async deleteFile(path: string) {
        try {
            // try to delete if exist
            await unlink(path)
        } catch {
            /* empty */
        }
    }

    #messageSacmCheck(message: Message) {
        if (!message.content.length) return
        const result = QuarentineService.isScamMessage(message.content)
    }

    static extractFeatures(raw: string) {
        const normalized = raw
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width

        const links = raw.match(/https?:\/\/\S+/g) || []

        return {
            linkCount: links.length,

            hasTelegram: links.some(l => l.includes('t.me')),
            hasZangi: links.some(l => l.includes('zangi')),

            hasCallToAction: /click|buy|interested|dm|text me|join/.test(
                normalized,
            ),

            suspiciousTone: /bro|only if|limited|hurry/.test(normalized),

            hasFancyUnicode: /[\u{1D400}-\u{1D7FF}]/gu.test(raw),

            // eslint-disable-next-line no-control-regex
            hasNonAscii: /[^\x00-\x7F]/.test(raw),

            hasMixedAlphabet:
                /[a-z].*[\u0400-\u04FF]|[\u0400-\u04FF].*[a-z]/i.test(raw),
        }
    }

    static isScamMessage(input: string) {
        const features = QuarentineService.extractFeatures(input)
        const { score, reasons } = QuarentineService.calculateScore(features)

        let level: ScamResult['level'] = 'low'
        if (score >= 6) level = 'high'
        else if (score >= 3) level = 'medium'

        const result: ScamResult = {
            score,
            isScam: score >= 5,
            level,
            reasons,
        }
        return result
    }

    static calculateScore(f: ScamFeatures) {
        let score = 0
        const reasons: string[] = []

        if (f.linkCount >= 2) {
            score += 2
            reasons.push('multiple links')
        }

        if (f.hasTelegram) {
            score += 2
            reasons.push('telegram link')
        }

        if (f.hasZangi) {
            score += 2
            reasons.push('zangi link')
        }

        if (f.hasCallToAction) {
            score += 2
            reasons.push('call to action')
        }

        if (f.suspiciousTone) {
            score += 1
            reasons.push('suspicious tone')
        }

        if (f.hasFancyUnicode) {
            score += 2
            reasons.push('fancy unicode')
        }

        if (f.hasMixedAlphabet) {
            score += 2
            reasons.push('mixed alphabets')
        }

        if (f.hasNonAscii) {
            score += 1
            reasons.push('non-ascii characters')
        }

        return { score, reasons }
    }
}

export const quarentineService = new QuarentineService()
