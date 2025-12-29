import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/client.js';
import "dotenv/config"

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_PATH
})
export const db = new PrismaClient({ adapter })