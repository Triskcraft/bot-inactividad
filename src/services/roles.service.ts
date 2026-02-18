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
import { PrismaClientKnownRequestError } from '../prisma/generated/internal/prismaNamespace.ts'
import roleRemove from '../interactions/buttons/role/role-remove.ts'
import { randomUUID } from 'node:crypto'
import roleEdit from '../interactions/buttons/role/role-edit.ts'
import roleDelete from '../interactions/buttons/role/role-delete.ts'
import rolePage from '../interactions/buttons/role/role-page.ts'
import { getMinecraftMembersCache } from '../members.cache.ts'
import { MinecraftRole } from '../classes/minecraft-role.ts'
import { MinecraftMember } from '../classes/minecraft-member.ts'
import { MinecraftRolesManager } from '../classes/minecraft-roles-manager.ts'

const PANNEL_NAME = '# 🎭 **Panel de Roles**'

class RoleService {
    #message: Message | null = null
    #selectedUser: string | null = null
    #defaultRole = {
        id: envs.DEFAULT_ROLE_ID,
        name: envs.DEFAULT_ROLE_NAME,
    }

    #roles = new MinecraftRolesManager()
    get roles() {
        return this.#roles
    }

    get pannelName() {
        return PANNEL_NAME
    }

    async start() {
        logger.info('Inicializando Role Service')
        await this.#roles.fetch()
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
        const roles = this.roles.cache

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
                                [
                                    ...role.players
                                        .values()
                                        .map(u => `**${u.nickname}**`),
                                ],
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
                getMinecraftMembersCache().set(
                    user.uuid,
                    new MinecraftMember({
                        discord_user_id: user.discord_user_id,
                        nickname: user.nickname,
                        rank: user.rank,
                        uuid: user.uuid,
                    }),
                )
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
        const role = this.roles.cache.get(roleId)
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
        role: MinecraftRole
        page?: number
    }) {
        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${role.name}\nJugadores con ese rol:`,
            ),
        )
        const pages = new Paginator([...role.players.values()], { peer: 5 })
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
                await this.roles.cache.get(role_id)?.addPlayer(mc_user_uuid)
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
            this.roles.cache.set(newRole.id, new MinecraftRole(newRole))
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
            await this.roles.cache
                .getOrInsert(id, new MinecraftRole({ id, name }))
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
            this.roles.cache.delete(id)
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
