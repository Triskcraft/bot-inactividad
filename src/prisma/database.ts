import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client.ts'
import 'dotenv/config'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_PATH,
})
export const db = new PrismaClient({ adapter })

// async function getRank(user: Member) {
//     const guild = client.guilds.cache.get(envs.guildId)!
//     const member = await guild.members.fetch(user.discord_id)

//     return {
//         ...user,
//         rank: rank_role?.name ?? "Miembro"
//     }
// }
