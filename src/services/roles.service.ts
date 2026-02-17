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
import RoleCreateButton from '../interactions/buttons/role/role-create.ts'
import { listMax, Paginator } from '../utils/format.ts'
import { Temporal } from '@js-temporal/polyfill'
import { minecraftMembersCache } from '../members.cache.ts'
import { PrismaClientKnownRequestError } from '../prisma/generated/internal/prismaNamespace.ts'
import roleRemove from '../interactions/buttons/role/role-remove.ts'
import { randomUUID } from 'node:crypto'
import roleEdit from '../interactions/buttons/role/role-edit.ts'
import roleDelete from '../interactions/buttons/role/role-delete.ts'
import rolePage from '../interactions/buttons/role/role-page.ts'

const PANNEL_NAME = '# 🎭 **Panel de Roles**'

type RoleFetched = Awaited<ReturnType<typeof RoleCached.fetchRoles>>[number]

type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export class RoleCached {
    static async fetchRoles() {
        const roles = await db.role.findMany({
            include: {
                linked_roles: {
                    include: {
                        minecraft_user: {
                            select: {
                                uuid: true,
                                nickname: true,
                            },
                        },
                    },
                },
            },
        })
        return roles.map(r => ({
            id: r.id,
            name: r.name,
            players: r.linked_roles.map(l => l.minecraft_user),
        }))
    }

    #id: string

    get id() {
        return this.#id
    }

    #name: string

    get name() {
        return this.#name
    }

    #players: {
        uuid: string
        nickname: string
    }[]

    get players() {
        return this.#players
    }

    constructor({
        id,
        name,
        players = [],
    }: MakeOptional<RoleFetched, 'players'>) {
        this.#id = id
        this.#name = name
        this.#players = players
    }

    async editName(name: string) {
        await db.role.update({
            data: { name },
            where: { id: this.#id },
        })
        logger.info(`[ROLE SERVICE] Rol ${this.#name} renombrado a ${name}`)
        if (this.#id === envs.DEFAULT_ROLE_ID) {
            envs.DEFAULT_ROLE_NAME = name
        }
        this.#name = name
        return this
    }

    async removePlayer(uuid: string) {
        try {
            const response = await db.linkedRole.delete({
                where: {
                    mc_user_uuid_role_id: {
                        mc_user_uuid: uuid,
                        role_id: this.#id,
                    },
                },
                select: {
                    minecraft_user: {
                        select: {
                            nickname: true,
                        },
                    },
                },
            })
            this.#players = this.#players.filter(p => p.uuid !== uuid)
            logger.info(
                `[ROLE SERVICE] Rol ${this.#name} desvinculado de ${response.minecraft_user.nickname}`,
            )
        } catch (error) {
            logger.error(error, '[ROLE SERVICE] Error desvinculando un rol')
        }
    }

    async addPlayer(uuid: string) {
        const response = await db.linkedRole.create({
            data: {
                role: {
                    connect: {
                        id: this.#id,
                    },
                },
                minecraft_user: {
                    connect: {
                        uuid: uuid,
                    },
                },
            },
            select: {
                minecraft_user: {
                    select: {
                        nickname: true,
                    },
                },
            },
        })
        this.#players.push({
            nickname: response.minecraft_user.nickname,
            uuid,
        })
        logger.info(
            `[ROLE SERVICE] Rol ${this.#name} agregado a ${response.minecraft_user.nickname}`,
        )
    }
}

class RoleService {
    #message: Message | null = null
    #rolesCache = new Map<string, RoleCached>()
    lastFetched = Temporal.Now.instant().epochMilliseconds
    #alreadyCached = false
    #selectedUser: string | null = null
    #defaultRole = {
        id: envs.DEFAULT_ROLE_ID,
        name: envs.DEFAULT_ROLE_NAME,
    }

    get pannelName() {
        return PANNEL_NAME
    }

    roleCache() {
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
        const cache = await RoleCached.fetchRoles()
        for (const role of cache) {
            this.#rolesCache.set(role.id, new RoleCached(role))
        }
        return this.#rolesCache
    }

    async start() {
        logger.info('Inicializando Role Service')
        await this.#chechDefaultRole()
        await this.renderPannel()
    }

    async #chechDefaultRole() {
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

    async renderPannel({ errors }: { errors?: { create?: string } } = {}) {
        const roles =
            this.#alreadyCached ?
                this.roleCache()
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
                                role.players.map(u => `**${u.nickname}**`),
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

        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                await RoleCreateButton.build(),
            ),
        )
        if (errors?.create) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(errors.create),
            )
        }
        container
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
                for (const { id, name } of user.linked_roles.map(l => l.role)) {
                    container.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `- ${name}`,
                                ),
                            )
                            .setButtonAccessory(
                                await roleRemove.build({ id, uuid: user.uuid }),
                            ),
                    )
                }
                container.addActionRowComponents(
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        await RoleAddStringMenu.build({
                            userUUID: user.uuid,
                            roles: [...roles.values()],
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

    async removeRoleFromPlayer({
        roleId,
        playerUUID,
        message,
    }: {
        roleId: string
        playerUUID: string
        message?: Message<true>
    }) {
        const role = this.roleCache().get(roleId)
        if (!role) return
        await role.removePlayer(playerUUID)
        if (message && message.editable) {
            message.edit({
                components: [await this.buildRolePannel({ role })],
                flags: MessageFlags.IsComponentsV2,
            })
        }
        await this.renderPannel()
    }

    async buildRolePannel({
        role,
        page: currentPage = 1,
    }: {
        role: RoleCached
        page?: number
    }) {
        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${role.name}\nJugadores con ese rol:`,
            ),
        )
        const pages = new Paginator(role.players, { peer: 5 })
        const { page, hasNext, hasPrev, items, totalPages } =
            pages.get(currentPage)
        if (items.length === 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `No se encontraron jugadores con ese rol`,
                ),
            )
        } else {
            for (const { nickname, uuid } of items) {
                container.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `- ${nickname}`,
                            ),
                        )
                        .setButtonAccessory(
                            await roleRemove.build({ id: role.id, uuid }),
                        ),
                )
            }
        }

        return container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                await rolePage.build({
                    id: role.id,
                    label: 'Anterior',
                    disabled: !hasPrev,
                    page: page - 1,
                }),
                new ButtonBuilder()
                    .setLabel(`Página ${page} de ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setCustomId(`${randomUUID()}`),
                await rolePage.build({
                    id: role.id,
                    label: 'Siguiente',
                    disabled: !hasNext,
                    page: page + 1,
                }),
                await roleDelete.build({ id: role.id }),
                await roleEdit.build({ id: role.id }),
            ),
        )
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
        await this.renderPannel()
        await db.state.upsert({
            where: { key: 'roles_panel_selected_user' },
            update: { value: uuid },
            create: { key: 'roles_panel_selected_user', value: uuid },
        })
    }

    async addRoles(mc_user_uuid: string, roles: string[]) {
        for (const role_id of roles) {
            try {
                await this.roleCache().get(role_id)?.addPlayer(mc_user_uuid)
            } catch (error) {
                if (error instanceof PrismaClientKnownRequestError) {
                    if (error.code !== 'P2002')
                        logger.error(error, 'Error al linkear rol')
                } else {
                    logger.error(error, 'Error al linkear rol')
                }
            }
        }
        await this.renderPannel()
    }

    async createRole(name: string) {
        try {
            const newRole = await db.role.create({
                data: { name },
            })
            this.#rolesCache.set(newRole.id, new RoleCached(newRole))
            this.renderPannel()
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    await this.renderPannel({
                        errors: { create: 'El rol ya existe' },
                    })
                    return setTimeout(() => this.renderPannel(), 5_000)
                }
            }
            logger.error(error, '[ROLE SERVICE] Error al crear un rol')

            await this.renderPannel({
                errors: { create: 'Error al crearlo' },
            })
            setTimeout(() => this.renderPannel(), 5_000)
        }
    }

    async editRole({ id, name }: { id: string; name: string }) {
        try {
            await this.#rolesCache
                .getOrInsert(id, new RoleCached({ id, name }))
                .editName(name)
            await this.renderPannel()
        } catch (error) {
            logger.error(error, '[ROLE SERVICE] Error al crear un rol')

            await this.renderPannel({
                errors: { create: 'Error al crearlo' },
            })
            setTimeout(() => this.renderPannel(), 5_000)
        }
    }

    async deleteRole({ id }: { id: string }) {
        try {
            await db.role.delete({
                where: { id },
            })
            this.#rolesCache.delete(id)
            await this.renderPannel()
        } catch (error) {
            logger.error(error, '[ROLE SERVICE] Error al crear un rol')

            await this.renderPannel({
                errors: { create: 'Error al crearlo' },
            })
            setTimeout(() => this.renderPannel(), 5_000)
        }
    }
}

export class AlreadyExistsError extends Error {}
export class UnknowError extends Error {
    constructor(cause: unknown) {
        super('Unknow Error', { cause })
    }
}

export const roleService = new RoleService()
