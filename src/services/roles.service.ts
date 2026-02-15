import { client } from '#client'
import { envs } from '#config'
import { db } from '#database'
import { logger } from '#logger'
import {
    ButtonStyle,
    ButtonBuilder,
    SectionBuilder,
    ComponentType,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
    type SendableChannels,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Message,
} from 'discord.js'
import RoleStringMenu from '../interactions/stringMenu/role.ts'
import RoleAddStringMenu from '../interactions/stringMenu/role-add.ts'
import { listMax } from '../utils/format.ts'
import { Temporal } from '@js-temporal/polyfill'
import { minecraftMembersCache } from '../members.cache.ts'
import { PrismaClientKnownRequestError } from '../prisma/generated/internal/prismaNamespace.ts'

const PANNEL_NAME = '# 🎭 **Panel de Roles**'

async function fetchRoles() {
    return await db.role.findMany({
        include: {
            linked_roles: {
                include: {
                    minecraft_user: true,
                },
            },
        },
    })
}

type RoleFetched = Awaited<ReturnType<typeof fetchRoles>>[number]

class RoleService {
    #message: Message | null = null
    #rolesCache = new Map<string, RoleFetched>()
    lastFetched = Temporal.Now.instant().epochMilliseconds
    #alreadyCached = false
    #selectedUser: string | null = null
    #defaultRole = {
        id: '',
        name: '',
    }

    #getRoleCache() {
        if (this.#rolesCache.size === 0) this.#updateRolesCache()
        else if (
            // every 6 hours
            this.lastFetched + 21_600_000 <
            Temporal.Now.instant().epochMilliseconds
        )
            this.#updateRolesCache()
        return this.#rolesCache
    }

    async #updateRolesCache() {
        const cache = await fetchRoles()
        for (const role of cache) {
            this.#rolesCache.set(role.id, role)
        }
        return this.#rolesCache
    }

    async start() {
        logger.info('Inicializando Role Service')
        await this.#chechDefaultRole()
        await this.#deployPannel()
    }

    async #chechDefaultRole() {
        const defaultRole = await db.role.findUnique({
            where: { name: envs.DEFAULT_ROLE },
        })
        if (!defaultRole) {
            try {
                this.#defaultRole = await db.role.create({
                    data: {
                        name: envs.DEFAULT_ROLE,
                    },
                })
            } catch (error) {
                logger.error(
                    error,
                    '[ROLE SERVICE] Default role can not be created',
                )
                process.exit(1)
            }
        } else {
            this.#defaultRole = defaultRole
        }
        const usersWithoutRoles = await db.minecraftUser.findMany({
            where: {
                linked_roles: {
                    none: {},
                },
            },
            select: {
                uuid: true,
                nickname: true,
            },
        })
        for (const { uuid, nickname } of usersWithoutRoles) {
            try {
                await db.linkedRole.create({
                    data: {
                        role: {
                            connect: {
                                id: this.#defaultRole.id,
                            },
                        },
                        minecraft_user: {
                            connect: {
                                uuid: uuid,
                            },
                        },
                    },
                })
                logger.info(
                    `[ROLE SERVICE] Rol ${this.#defaultRole.name} agregado a ${nickname}`,
                )
            } catch {
                // ignore
            }
        }
    }

    async #deployPannel() {
        const roles =
            this.#alreadyCached ?
                this.#getRoleCache()
            :   await this.#updateRolesCache()
        this.#alreadyCached ||= true

        const channel = await client.channels.fetch(envs.PANEL_CHANNEL_ID)
        if (!channel) {
            return logger.warn('[ROLE SERVICE] Canal de panel no encontrado')
        }
        if (!channel.isSendable()) {
            return logger.warn(
                '[ROLE SERVICE] El canal de pannel no está disponible',
            )
        }
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    PANNEL_NAME +
                        '\nAdministra los roles del servidor de Minecraft.',
                ),
            )
            .addSeparatorComponents(new SeparatorBuilder())

        for (const role of roles.values()) {
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `- **${role.name}**\nAsignado a ${listMax(
                                role.linked_roles.map(
                                    l => `**${l.minecraft_user.nickname}**`,
                                ),
                                2,
                            )}`,
                        ),
                    )
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setLabel('Seleccionar')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId(`role:select:${role.id}`),
                    ),
            )
        }

        container
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel('➕ Crear Rol')
                        .setStyle(ButtonStyle.Success)
                        .setCustomId('role:create'),
                ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    '## Jugadores\nSelecciona un jugador para ver y/o administrar sus roles',
                ),
            )

        const selected = await this.#getSelectedUser()
        container.addActionRowComponents(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                await RoleStringMenu.build({ selected }),
            ),
        )
        if (selected) {
            const user = await db.minecraftUser.findFirst({
                where: { uuid: selected },
                include: { linked_roles: { select: { role: true } } },
            })
            if (!user) {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        'Lo lamento, no se encontro ese jugador',
                    ),
                )
            } else {
                minecraftMembersCache.set(user.uuid, {
                    discord_user_id: user.discord_user_id,
                    nickname: user.nickname,
                    rank: user.rank,
                    uuid: user.uuid,
                })
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('Roles:'),
                )
                const roles = user.linked_roles.map(l => l.role)
                for (const { id, name } of roles) {
                    container.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `- ${name}`,
                                ),
                            )
                            .setButtonAccessory(
                                new ButtonBuilder()
                                    .setLabel('Eliminar')
                                    .setStyle(ButtonStyle.Danger)
                                    .setCustomId(`role:remove:${id}`),
                            ),
                    )
                }
                container.addActionRowComponents(
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        await RoleAddStringMenu.build({
                            userUUID: user.uuid,
                            roles,
                        }),
                    ),
                )
            }
        }

        const whpmid = await db.state.findUnique({
            where: { key: 'roles_panel_message_id' },
            select: { value: true },
        })
        if (this.#message) {
            this.#message.edit({
                components: [container],
            })
        } else if (whpmid) {
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
            where: { key: 'roles_panel_message_id' },
            update: { value: nid },
            create: { key: 'roles_panel_message_id', value: nid },
        })
    }

    async #getSelectedUser() {
        if (this.#selectedUser) return this.#selectedUser
        const sdb = await db.state.findUnique({
            where: { key: 'roles_panel_selected_user' },
        })
        return sdb?.value ?? null
    }

    async selectUser(uuid: string) {
        this.#selectedUser = uuid
        await this.#deployPannel()
        await db.state.upsert({
            where: { key: 'roles_panel_selected_user' },
            update: { value: uuid },
            create: { key: 'roles_panel_selected_user', value: uuid },
        })
    }

    async addRoles(mc_user_uuid: string, roles: string[]) {
        for (const role_id of roles) {
            try {
                const link = await db.linkedRole.create({
                    data: {
                        mc_user_uuid,
                        role_id,
                    },
                    select: {
                        role: {
                            select: {
                                name: true,
                            },
                        },
                        minecraft_user: {
                            select: {
                                nickname: true,
                            },
                        },
                    },
                })
                logger.info(
                    `[ROLE SERVICE] Rol ${link.role.name} agregado a ${link.minecraft_user.nickname}`,
                )
            } catch (error) {
                if (error instanceof PrismaClientKnownRequestError) {
                    if (error.code !== 'P2002')
                        logger.error(error, 'Error al linkear rol')
                } else {
                    logger.error(error, 'Error al linkear rol')
                }
            }
        }
        await this.#deployPannel()
    }
}

export const roleService = new RoleService()
