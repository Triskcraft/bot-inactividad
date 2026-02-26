import { client } from '#client'
import { envs } from '#config'
import { db } from '#database'
import { logger } from '#logger'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ComponentType,
    ContainerBuilder,
    GuildMember,
    Message,
    MessageFlags,
    Role,
    SeparatorBuilder,
    TextDisplayBuilder,
    ThreadAutoArchiveDuration,
    type SendableChannels,
} from 'discord.js'
import blogCreate from '../interactions/buttons/blog/blog-create.ts'

const PANNEL_NAME = '# 📰 **Panel de Publicaciones**'

class BlogService {
    #message: Message | null = null
    #role: Role | null = null
    #channel: SendableChannels | null = null

    get role() {
        return this.#role
    }

    get channel() {
        return this.#channel
    }

    async start() {
        logger.info('[BLOG SERVICE] Inicializando...')
        await this.#checkRole()
        if (!this.#role) return
        await this.#checkChannel()
        if (!this.#channel) return
        await this.#renderPannel()
    }

    async #checkRole() {
        this.#role =
            (await client.guilds.cache
                .get(envs.guildId)
                ?.roles.fetch(envs.BLOG_ROLE_ID)
                .catch(() => null)) ?? null
        if (!this.#role) {
            logger.error(
                `[BLOG SERVICE] El rol ${envs.BLOG_ROLE_ID} no se encuentra disponible, se omitirá la inicialización`,
            )
        }
    }

    async #checkChannel() {
        const channel =
            client.channels.cache.get(envs.BLOG_CHANNEL_ID) ??
            (await client.channels.fetch(envs.BLOG_CHANNEL_ID))
        if (!channel) {
            return logger.warn(
                '[BLOG SERVICE] Canal de blog no encontrado, se omitirá la inicialización',
            )
        }
        if (!channel.isSendable()) {
            return logger.warn(
                '[BLOG SERVICE] El canal de pannel no está disponible, se omitirá la inicialización',
            )
        }
        this.#channel = channel
    }

    async createDraft({
        member,
        title,
    }: {
        member: GuildMember
        title: string
    }) {
        if (!this.#channel) return
        const message = await this.#channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${title}\nAutor: ${member}\nEstado: Draft`,
                    ),
                ),
            ],
        })
        const thread = await message.startThread({
            name: title,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        })
        await thread.members.add(member)
    }

    async #renderPannel() {
        const channel =
            client.channels.cache.get(envs.BLOG_CHANNEL_ID) ??
            (await client.channels.fetch(envs.BLOG_CHANNEL_ID))
        if (!channel) {
            return logger.warn('[BLOG SERVICE] Canal de panel no encontrado')
        }
        if (!channel.isSendable()) {
            return logger.warn(
                '[BLOG SERVICE] El canal de pannel no está disponible',
            )
        }

        const container = await this.#buildPanel()

        if (this.#message) {
            this.#message.edit({
                components: [container],
            })
        } else {
            const whpmid = await db.state.findUnique({
                where: { key: 'blog_panel_message_id' },
                select: { value: true },
            })
            if (whpmid) {
                const anc = await channel.messages
                    .fetch(whpmid.value)
                    .catch(() => null)
                if (anc) {
                    await anc.edit({
                        components: [container],
                    })
                } else {
                    await this.#checkPinned(channel, container)
                }
            } else {
                await this.#checkPinned(channel, container)
            }
        }
    }

    async #buildPanel() {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    PANNEL_NAME +
                        '\nCrea y administra borradores de entradas para el blog.',
                ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    await blogCreate.build(),
                ),
            )

        return container
    }

    async #checkPinned(channel: SendableChannels, container: ContainerBuilder) {
        const pinned = await channel.messages.fetchPins()

        const my = pinned.items.find(msg => {
            const container = msg.message.components[0]
            if (!container) return false
            if (container.type !== ComponentType.Container) return false
            const textDisplay = container.components[0]
            if (!textDisplay) return false
            if (textDisplay.type !== ComponentType.TextDisplay) return false
            return (
                msg.message.author.id === client.user.id &&
                textDisplay.content.includes(PANNEL_NAME)
            )
        })
        let nid: string
        if (my) {
            await my.message.edit({
                components: [container],
            })
            nid = my.message.id
        } else {
            this.#message = await channel.send({
                components: [container],
                flags:
                    MessageFlags.IsComponentsV2 |
                    MessageFlags.SuppressNotifications,
            })
            nid = this.#message.id
            await this.#message.pin()
        }
        await db.state.upsert({
            where: { key: 'blog_panel_message_id' },
            update: { value: nid },
            create: { key: 'blog_panel_message_id', value: nid },
        })
    }
}

export const blogService = new BlogService()
