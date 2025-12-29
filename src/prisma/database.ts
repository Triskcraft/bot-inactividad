import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import "dotenv/config"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_PATH,
})
export const db = new PrismaClient({ adapter })