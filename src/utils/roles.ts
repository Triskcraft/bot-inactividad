import { RANK_ROLES } from '#config'
import type { Role } from 'discord.js'

export function getRank(roles: Role[]) {
    const [rank_role] = roles
        .map(role => {
            return {
                id: role.id,
                name: role.name,
                position: RANK_ROLES.indexOf(role.id),
            }
        })
        .filter(role => role.position >= 0)
        .sort((a, b) => a.position - b.position)
    return rank_role?.name ?? 'Miembro'
}
