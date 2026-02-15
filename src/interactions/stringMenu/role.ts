import {
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from 'discord.js'
import { StringMenuHandler } from '#interactions.service'
import { roleService } from '../../services/roles.service.ts'
import { getMinecraftMembersCache } from '../../members.cache.ts'

export default class extends StringMenuHandler {
    override regex = /^role:mcu$/

    static override async build({ selected }: { selected: string | null }) {
        const selectUserMenu = new StringSelectMenuBuilder()
            .setCustomId('role:mcu')
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder('Selecciona un usuario')

        for (const { nickname, uuid } of getMinecraftMembersCache().values()) {
            selectUserMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(nickname)
                    .setValue(uuid)
                    .setDefault(uuid === selected),
            )
        }
        return selectUserMenu
    }

    override async run(interaction: StringSelectMenuInteraction<'cached'>) {
        await interaction.deferUpdate()
        const value = interaction.values[0]!
        await roleService.selectUser(value)
    }
}
