-- ! added after generated
PRAGMA journal_mode = WAL;

-- CreateTable
CREATE TABLE "inactivity_periods" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "guild_id" TEXT NOT NULL,
    "role_snapshot" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "tracked_roles" (
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("guild_id", "role_id")
);

-- CreateTable
CREATE TABLE "role_statistics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "inactive_count" INTEGER NOT NULL,
    "active_count" INTEGER NOT NULL,
    "captured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discord_id" TEXT NOT NULL,
    "mc_id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "link_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discord_id" TEXT NOT NULL,
    "discord_nickname" TEXT NOT NULL,
    "code" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "links_discord_id_key" ON "links"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "links_mc_id_key" ON "links"("mc_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_discord_id_key" ON "link_codes"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_code_key" ON "link_codes"("code");
