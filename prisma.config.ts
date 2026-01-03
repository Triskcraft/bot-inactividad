import { defineConfig } from 'prisma/config'
try {
    process.loadEnvFile()
} catch {
    console.error('No existe .env')
}

export default defineConfig({
    schema: 'src/prisma/schema.prisma',

    datasource: {
        url: process.env.DATABASE_PATH!,
    },
})
