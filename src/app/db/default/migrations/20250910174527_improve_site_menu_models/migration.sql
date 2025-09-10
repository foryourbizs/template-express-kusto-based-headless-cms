-- AlterTable
ALTER TABLE "public"."site_menus" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requireLogin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."site_menu_roles" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "menuUuid" UUID NOT NULL,
    "roleUuid" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_menu_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_menu_roles_uuid_key" ON "public"."site_menu_roles"("uuid");

-- CreateIndex
CREATE INDEX "site_menu_roles_menuUuid_idx" ON "public"."site_menu_roles"("menuUuid");

-- CreateIndex
CREATE INDEX "site_menu_roles_roleUuid_idx" ON "public"."site_menu_roles"("roleUuid");

-- CreateIndex
CREATE INDEX "site_menu_roles_deletedAt_idx" ON "public"."site_menu_roles"("deletedAt");

-- CreateIndex
CREATE INDEX "site_menu_roles_expiresAt_idx" ON "public"."site_menu_roles"("expiresAt");

-- CreateIndex
CREATE INDEX "site_menu_roles_menuUuid_roleUuid_idx" ON "public"."site_menu_roles"("menuUuid", "roleUuid");

-- CreateIndex
CREATE UNIQUE INDEX "site_menu_roles_menuUuid_roleUuid_key" ON "public"."site_menu_roles"("menuUuid", "roleUuid");

-- CreateIndex
CREATE INDEX "site_menus_isPublic_idx" ON "public"."site_menus"("isPublic");

-- CreateIndex
CREATE INDEX "site_menus_requireLogin_idx" ON "public"."site_menus"("requireLogin");

-- CreateIndex
CREATE INDEX "site_menus_displayOrder_idx" ON "public"."site_menus"("displayOrder");

-- CreateIndex
CREATE INDEX "site_menus_groupKey_displayOrder_idx" ON "public"."site_menus"("groupKey", "displayOrder");

-- CreateIndex
CREATE INDEX "site_menus_isPublic_requireLogin_idx" ON "public"."site_menus"("isPublic", "requireLogin");

-- AddForeignKey
ALTER TABLE "public"."site_menu_roles" ADD CONSTRAINT "site_menu_roles_menuUuid_fkey" FOREIGN KEY ("menuUuid") REFERENCES "public"."site_menus"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menu_roles" ADD CONSTRAINT "site_menu_roles_roleUuid_fkey" FOREIGN KEY ("roleUuid") REFERENCES "public"."roles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
