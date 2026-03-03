import { MinecraftMembersManager } from '#/classes/minecraft-members-manager.ts'

const membersMannager = new MinecraftMembersManager()
await membersMannager.fetch()

export { membersMannager }
