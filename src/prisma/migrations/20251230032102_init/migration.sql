
-- ! Migration customized for snowflake
-- ! This migration is not compatible with the default migration
-- ! You need to run this migration first

-- Fecha base: 01/06/2025
CREATE OR REPLACE FUNCTION snowflake(node_id int DEFAULT 0)
RETURNS text AS $$
DECLARE
    our_epoch bigint := 1748736000000; -- milisegundos desde 01/06/2025
    seq_id bigint;
    now_millis bigint;
    safe_node_id int;
    snowflake_id bigint;
BEGIN
    -- Asegurar que node_id esté entre 0 y 1023 (10 bits)
    safe_node_id := GREATEST(0, LEAST(node_id, 1023));

    -- Usar la secuencia para obtener un número siempre único
    SELECT nextval('snowflake_seq') % 4096 INTO seq_id; -- 12 bits
    SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000) INTO now_millis;

    snowflake_id := ((now_millis - our_epoch) << 22)  -- timestamp (41 bits)
                  | ((safe_node_id & 1023) << 12)     -- node id (10 bits)
                  | (seq_id & 4095);                  -- secuencia (12 bits)

    RETURN snowflake_id::text; -- Convertir a string
END;
$$ LANGUAGE plpgsql;

-- Crear secuencia si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'snowflake_seq') THEN
        CREATE SEQUENCE snowflake_seq;
    END IF;
END$$;

-- ! Prisma generation

-- CreateTable
CREATE TABLE "inactivity_periods" (
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "role_snapshot" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL,

    CONSTRAINT "inactivity_periods_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tracked_roles" (
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_roles_pkey" PRIMARY KEY ("guild_id","role_id")
);

-- CreateTable
CREATE TABLE "role_statistics" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "inactive_count" INTEGER NOT NULL,
    "active_count" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "discord_id" TEXT NOT NULL,
    "mc_id" TEXT NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_codes" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "discord_id" TEXT NOT NULL,
    "discord_nickname" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "links_discord_id_key" ON "links"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "links_mc_id_key" ON "links"("mc_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_discord_id_key" ON "link_codes"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_code_key" ON "link_codes"("code");
