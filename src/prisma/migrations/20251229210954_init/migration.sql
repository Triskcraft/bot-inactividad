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
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "inactive_count" INTEGER NOT NULL,
    "active_count" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" SERIAL NOT NULL,
    "discord_id" TEXT NOT NULL,
    "mc_id" TEXT NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_codes" (
    "id" SERIAL NOT NULL,
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
