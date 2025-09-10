-- CreateEnum
CREATE TYPE "public"."MenuType" AS ENUM ('INTERNAL_LINK', 'EXTERNAL_LINK', 'BUTTON');

-- CreateTable
CREATE TABLE "public"."site_menus" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "groupKey" VARCHAR(30) NOT NULL,
    "parentUUID" UUID,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "type" "public"."MenuType" NOT NULL DEFAULT 'INTERNAL_LINK',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."site_menu_metadata" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "menuUuid" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_menu_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_menus_uuid_key" ON "public"."site_menus"("uuid");

-- CreateIndex
CREATE INDEX "site_menus_uuid_idx" ON "public"."site_menus"("uuid");

-- CreateIndex
CREATE INDEX "site_menus_groupKey_idx" ON "public"."site_menus"("groupKey");

-- CreateIndex
CREATE INDEX "site_menus_parentUUID_idx" ON "public"."site_menus"("parentUUID");

-- CreateIndex
CREATE INDEX "site_menus_type_idx" ON "public"."site_menus"("type");

-- CreateIndex
CREATE INDEX "site_menus_deletedAt_idx" ON "public"."site_menus"("deletedAt");

-- CreateIndex
CREATE INDEX "site_menus_createdAt_idx" ON "public"."site_menus"("createdAt");

-- CreateIndex
CREATE INDEX "site_menus_groupKey_parentUUID_idx" ON "public"."site_menus"("groupKey", "parentUUID");

-- CreateIndex
CREATE UNIQUE INDEX "site_menu_metadata_uuid_key" ON "public"."site_menu_metadata"("uuid");

-- CreateIndex
CREATE INDEX "site_menu_metadata_uuid_idx" ON "public"."site_menu_metadata"("uuid");

-- CreateIndex
CREATE INDEX "site_menu_metadata_menuUuid_idx" ON "public"."site_menu_metadata"("menuUuid");

-- CreateIndex
CREATE INDEX "site_menu_metadata_key_idx" ON "public"."site_menu_metadata"("key");

-- CreateIndex
CREATE INDEX "site_menu_metadata_deletedAt_idx" ON "public"."site_menu_metadata"("deletedAt");

-- CreateIndex
CREATE INDEX "site_menu_metadata_menuUuid_key_idx" ON "public"."site_menu_metadata"("menuUuid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "site_menu_metadata_menuUuid_key_key" ON "public"."site_menu_metadata"("menuUuid", "key");

-- AddForeignKey
ALTER TABLE "public"."site_menus" ADD CONSTRAINT "site_menus_parentUUID_fkey" FOREIGN KEY ("parentUUID") REFERENCES "public"."site_menus"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menu_metadata" ADD CONSTRAINT "site_menu_metadata_menuUuid_fkey" FOREIGN KEY ("menuUuid") REFERENCES "public"."site_menus"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
