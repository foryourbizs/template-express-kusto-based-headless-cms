-- CreateEnum
CREATE TYPE "public"."FileAccessLevel" AS ENUM ('PUBLIC', 'PRIVATE', 'PROTECTED', 'INTERNAL');

-- CreateTable
CREATE TABLE "public"."object_storages" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "baseUrl" VARCHAR(500) NOT NULL,
    "bucketName" VARCHAR(100) NOT NULL,
    "region" VARCHAR(50) NOT NULL DEFAULT 'auto',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_storages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."files" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "extension" VARCHAR(10),
    "storageUuid" UUID NOT NULL,
    "filePath" VARCHAR(1000) NOT NULL,
    "exists" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "md5Hash" VARCHAR(32),
    "sha256Hash" VARCHAR(64),
    "uploadedBy" UUID,
    "uploadSource" VARCHAR(50),
    "metadata" JSONB,
    "accessPermissionUuid" UUID,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "object_storages_uuid_key" ON "public"."object_storages"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "object_storages_name_key" ON "public"."object_storages"("name");

-- CreateIndex
CREATE INDEX "object_storages_name_idx" ON "public"."object_storages"("name");

-- CreateIndex
CREATE INDEX "object_storages_provider_idx" ON "public"."object_storages"("provider");

-- CreateIndex
CREATE INDEX "object_storages_isDefault_isActive_idx" ON "public"."object_storages"("isDefault", "isActive");

-- CreateIndex
CREATE INDEX "object_storages_deletedAt_idx" ON "public"."object_storages"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "files_uuid_key" ON "public"."files"("uuid");

-- CreateIndex
CREATE INDEX "files_uuid_idx" ON "public"."files"("uuid");

-- CreateIndex
CREATE INDEX "files_filename_idx" ON "public"."files"("filename");

-- CreateIndex
CREATE INDEX "files_mimeType_idx" ON "public"."files"("mimeType");

-- CreateIndex
CREATE INDEX "files_exists_idx" ON "public"."files"("exists");

-- CreateIndex
CREATE INDEX "files_uploadedBy_idx" ON "public"."files"("uploadedBy");

-- CreateIndex
CREATE INDEX "files_storageUuid_filePath_idx" ON "public"."files"("storageUuid", "filePath");

-- CreateIndex
CREATE INDEX "files_isPublic_accessPermissionUuid_idx" ON "public"."files"("isPublic", "accessPermissionUuid");

-- CreateIndex
CREATE INDEX "files_createdAt_idx" ON "public"."files"("createdAt");

-- CreateIndex
CREATE INDEX "files_deletedAt_idx" ON "public"."files"("deletedAt");

-- CreateIndex
CREATE INDEX "files_expiresAt_idx" ON "public"."files"("expiresAt");

-- CreateIndex
CREATE INDEX "files_md5Hash_idx" ON "public"."files"("md5Hash");

-- CreateIndex
CREATE INDEX "files_isArchived_deletedAt_idx" ON "public"."files"("isArchived", "deletedAt");

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_accessPermissionUuid_fkey" FOREIGN KEY ("accessPermissionUuid") REFERENCES "public"."permissions"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_storageUuid_fkey" FOREIGN KEY ("storageUuid") REFERENCES "public"."object_storages"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
