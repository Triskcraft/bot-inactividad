import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client.ts'
try {
    process.loadEnvFile()
} catch {
    console.error('No existe .env')
}

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_PATH,
})
export const db = new PrismaClient({ adapter })
