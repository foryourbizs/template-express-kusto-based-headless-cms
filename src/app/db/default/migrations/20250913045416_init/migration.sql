-- CreateEnum
CREATE TYPE "public"."LoginMethod" AS ENUM ('PASSWORD', 'TWO_FACTOR', 'OAUTH', 'SSO', 'BIOMETRIC', 'TOKEN_REFRESH');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'BANNED');

-- CreateEnum
CREATE TYPE "public"."TokenType" AS ENUM ('ACCESS', 'REFRESH', 'RESET_PASSWORD', 'EMAIL_VERIFICATION', 'TWO_FACTOR');

-- CreateEnum
CREATE TYPE "public"."TokenRevocationReason" AS ENUM ('LOGOUT', 'SECURITY_BREACH', 'PASSWORD_CHANGE', 'ADMIN_ACTION', 'TOKEN_THEFT', 'EXPIRED', 'USER_REQUESTED');

-- CreateEnum
CREATE TYPE "public"."SecurityEventType" AS ENUM ('FAILED_LOGIN', 'SUSPICIOUS_IP', 'TOKEN_THEFT', 'BRUTE_FORCE', 'ACCOUNT_LOCKOUT', 'PASSWORD_CHANGE', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED');

-- CreateEnum
CREATE TYPE "public"."SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'PROFILE_UPDATE', 'PASSWORD_CHANGE', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'ACCOUNT_CREATED', 'ACCOUNT_DELETED', 'ACCOUNT_SUSPENDED', 'ADMIN_ACTION', 'TOKEN_REFRESH');

-- CreateEnum
CREATE TYPE "public"."MenuType" AS ENUM ('INTERNAL_LINK', 'EXTERNAL_LINK', 'BUTTON');

-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('POST', 'PAGE', 'ATTACHMENT', 'REVISION', 'CUSTOM_POST', 'PRODUCT', 'EVENT', 'GALLERY', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."PostStatus" AS ENUM ('PUBLISH', 'DRAFT', 'PRIVATE', 'PENDING', 'TRASH', 'AUTO_DRAFT', 'INHERIT', 'FUTURE');

-- CreateEnum
CREATE TYPE "public"."CommentStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."PingStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS');

-- CreateEnum
CREATE TYPE "public"."FileAccessLevel" AS ENUM ('PUBLIC', 'PRIVATE', 'PROTECTED', 'INTERNAL');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "phoneNumber" VARCHAR(20),
    "profileImage" VARCHAR(500),
    "timezone" VARCHAR(50) DEFAULT 'UTC',
    "locale" VARCHAR(10) DEFAULT 'en-US',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" VARCHAR(100),
    "passwordResetToken" VARCHAR(255),
    "passwordResetExpires" TIMESTAMP(3),
    "emailVerificationToken" VARCHAR(255),
    "emailVerificationExpires" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(45),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMP(3),
    "jwtVersion" INTEGER NOT NULL DEFAULT 1,
    "lastPasswordChange" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "id" BIGSERIAL NOT NULL,
    "userUuid" UUID NOT NULL,
    "roleUuid" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "roleUuid" UUID NOT NULL,
    "permissionUuid" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_permissions" (
    "id" BIGSERIAL NOT NULL,
    "userUuid" UUID NOT NULL,
    "permissionUuid" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_token_blacklist" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "userUuid" UUID,
    "jti" VARCHAR(100) NOT NULL,
    "tokenType" "public"."TokenType" NOT NULL,
    "reason" "public"."TokenRevocationReason" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_token_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_rate_limits" (
    "id" BIGSERIAL NOT NULL,
    "userUuid" UUID,
    "ipAddress" VARCHAR(45) NOT NULL,
    "endpoint" VARCHAR(200) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockUntil" TIMESTAMP(3),
    "userAgent" TEXT,
    "lastRequest" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_security_events" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "userUuid" UUID,
    "eventType" "public"."SecurityEventType" NOT NULL,
    "severity" "public"."SecuritySeverity" NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "endpoint" VARCHAR(200),
    "method" VARCHAR(10),
    "riskScore" DOUBLE PRECISION,
    "detectionRule" VARCHAR(100),
    "actionTaken" VARCHAR(100),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "userUuid" UUID NOT NULL,
    "jti" VARCHAR(100) NOT NULL,
    "refreshJti" VARCHAR(100),
    "familyId" VARCHAR(100) NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "deviceInfo" TEXT,
    "deviceId" VARCHAR(100),
    "ipAddress" VARCHAR(45),
    "location" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCompromised" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "loginMethod" "public"."LoginMethod",
    "trustScore" DOUBLE PRECISION DEFAULT 1.0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_refresh_tokens" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "userUuid" UUID NOT NULL,
    "jti" VARCHAR(100) NOT NULL,
    "familyId" VARCHAR(100) NOT NULL,
    "generation" INTEGER NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "deviceInfo" TEXT,
    "deviceId" VARCHAR(100),
    "ipAddress" VARCHAR(45),
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserUuid" BIGINT,
    "usedAt" TIMESTAMP(3),
    "parentJti" VARCHAR(100),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "trustScore" DOUBLE PRECISION DEFAULT 1.0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "userUuid" UUID,
    "action" "public"."AuditAction" NOT NULL,
    "resource" VARCHAR(50),
    "resourceId" VARCHAR(100),
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_jwt_configs" (
    "id" BIGSERIAL NOT NULL,
    "configName" VARCHAR(100) NOT NULL,
    "accessTokenTtl" INTEGER NOT NULL,
    "refreshTokenTtl" INTEGER NOT NULL,
    "issuer" VARCHAR(255) NOT NULL,
    "audience" VARCHAR(255) NOT NULL,
    "algorithm" VARCHAR(20) NOT NULL DEFAULT 'RS256',
    "allowRefreshRotation" BOOLEAN NOT NULL DEFAULT true,
    "maxRefreshTokens" INTEGER NOT NULL DEFAULT 5,
    "requireDeviceId" BOOLEAN NOT NULL DEFAULT false,
    "enableFingerprinting" BOOLEAN NOT NULL DEFAULT true,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDuration" INTEGER NOT NULL DEFAULT 900,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_jwt_configs_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."site_menu_group_keys" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "key" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "site_menu_group_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."site_menus" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "groupKeyUuid" UUID NOT NULL,
    "parentUUID" UUID,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "type" "public"."MenuType" NOT NULL DEFAULT 'INTERNAL_LINK',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "requireLogin" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "authorUuid" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "excerpt" VARCHAR(1000),
    "slug" VARCHAR(200) NOT NULL,
    "postType" "public"."PostType" NOT NULL DEFAULT 'POST',
    "postStatus" "public"."PostStatus" NOT NULL DEFAULT 'DRAFT',
    "commentStatus" "public"."CommentStatus" NOT NULL DEFAULT 'OPEN',
    "pingStatus" "public"."PingStatus" NOT NULL DEFAULT 'OPEN',
    "postPassword" VARCHAR(255),
    "parentUuid" UUID,
    "menuOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" VARCHAR(255),
    "metaDescription" VARCHAR(500),
    "featuredImage" UUID,
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "likeCount" BIGINT NOT NULL DEFAULT 0,
    "commentCount" BIGINT NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_meta" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "postUuid" UUID NOT NULL,
    "metaKey" VARCHAR(255) NOT NULL,
    "metaValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."terms" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."term_taxonomy" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "termUuid" UUID NOT NULL,
    "taxonomy" VARCHAR(32) NOT NULL,
    "description" TEXT,
    "parentUuid" UUID,
    "count" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_taxonomy" (
    "id" BIGSERIAL NOT NULL,
    "postUuid" UUID NOT NULL,
    "termTaxonomyUuid" UUID NOT NULL,
    "termOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "postUuid" UUID NOT NULL,
    "parentUuid" UUID,
    "authorUuid" UUID,
    "authorName" VARCHAR(255) NOT NULL,
    "authorEmail" VARCHAR(255) NOT NULL,
    "authorUrl" VARCHAR(500),
    "authorIp" VARCHAR(45),
    "content" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "spamScore" DOUBLE PRECISION DEFAULT 0.0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_revisions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "postUuid" UUID NOT NULL,
    "authorUuid" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "excerpt" VARCHAR(1000),
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "changeReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "public"."users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_uuid_idx" ON "public"."users"("uuid");

-- CreateIndex
CREATE INDEX "users_deletedAt_isActive_isVerified_idx" ON "public"."users"("deletedAt", "isActive", "isVerified");

-- CreateIndex
CREATE INDEX "users_email_deletedAt_idx" ON "public"."users"("email", "deletedAt");

-- CreateIndex
CREATE INDEX "users_uuid_deletedAt_idx" ON "public"."users"("uuid", "deletedAt");

-- CreateIndex
CREATE INDEX "users_username_deletedAt_idx" ON "public"."users"("username", "deletedAt");

-- CreateIndex
CREATE INDEX "users_loginAttempts_lockoutUntil_idx" ON "public"."users"("loginAttempts", "lockoutUntil");

-- CreateIndex
CREATE INDEX "users_isActive_lastLoginAt_idx" ON "public"."users"("isActive", "lastLoginAt");

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "public"."users"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "users_passwordResetToken_idx" ON "public"."users"("passwordResetToken");

-- CreateIndex
CREATE INDEX "users_createdAt_isActive_idx" ON "public"."users"("createdAt", "isActive");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "public"."users"("lastLoginAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_createdAt_idx" ON "public"."users"("deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_uuid_key" ON "public"."roles"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "roles_isActive_isSystem_idx" ON "public"."roles"("isActive", "isSystem");

-- CreateIndex
CREATE INDEX "roles_deletedAt_idx" ON "public"."roles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_uuid_key" ON "public"."permissions"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "public"."permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "public"."permissions"("resource");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "public"."permissions"("action");

-- CreateIndex
CREATE INDEX "permissions_deletedAt_idx" ON "public"."permissions"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "public"."permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "user_roles_userUuid_idx" ON "public"."user_roles"("userUuid");

-- CreateIndex
CREATE INDEX "user_roles_roleUuid_idx" ON "public"."user_roles"("roleUuid");

-- CreateIndex
CREATE INDEX "user_roles_expiresAt_idx" ON "public"."user_roles"("expiresAt");

-- CreateIndex
CREATE INDEX "user_roles_deletedAt_idx" ON "public"."user_roles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userUuid_roleUuid_key" ON "public"."user_roles"("userUuid", "roleUuid");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_uuid_key" ON "public"."role_permissions"("uuid");

-- CreateIndex
CREATE INDEX "role_permissions_roleUuid_idx" ON "public"."role_permissions"("roleUuid");

-- CreateIndex
CREATE INDEX "role_permissions_permissionUuid_idx" ON "public"."role_permissions"("permissionUuid");

-- CreateIndex
CREATE INDEX "role_permissions_deletedAt_idx" ON "public"."role_permissions"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleUuid_permissionUuid_key" ON "public"."role_permissions"("roleUuid", "permissionUuid");

-- CreateIndex
CREATE INDEX "user_permissions_userUuid_idx" ON "public"."user_permissions"("userUuid");

-- CreateIndex
CREATE INDEX "user_permissions_permissionUuid_idx" ON "public"."user_permissions"("permissionUuid");

-- CreateIndex
CREATE INDEX "user_permissions_expiresAt_idx" ON "public"."user_permissions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_permissions_deletedAt_idx" ON "public"."user_permissions"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userUuid_permissionUuid_key" ON "public"."user_permissions"("userUuid", "permissionUuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_token_blacklist_uuid_key" ON "public"."user_token_blacklist"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_token_blacklist_jti_key" ON "public"."user_token_blacklist"("jti");

-- CreateIndex
CREATE INDEX "user_token_blacklist_jti_idx" ON "public"."user_token_blacklist"("jti");

-- CreateIndex
CREATE INDEX "user_token_blacklist_userUuid_idx" ON "public"."user_token_blacklist"("userUuid");

-- CreateIndex
CREATE INDEX "user_token_blacklist_tokenType_idx" ON "public"."user_token_blacklist"("tokenType");

-- CreateIndex
CREATE INDEX "user_token_blacklist_expiresAt_idx" ON "public"."user_token_blacklist"("expiresAt");

-- CreateIndex
CREATE INDEX "user_token_blacklist_createdAt_idx" ON "public"."user_token_blacklist"("createdAt");

-- CreateIndex
CREATE INDEX "user_token_blacklist_reason_idx" ON "public"."user_token_blacklist"("reason");

-- CreateIndex
CREATE INDEX "user_rate_limits_userUuid_idx" ON "public"."user_rate_limits"("userUuid");

-- CreateIndex
CREATE INDEX "user_rate_limits_ipAddress_idx" ON "public"."user_rate_limits"("ipAddress");

-- CreateIndex
CREATE INDEX "user_rate_limits_endpoint_method_idx" ON "public"."user_rate_limits"("endpoint", "method");

-- CreateIndex
CREATE INDEX "user_rate_limits_windowEnd_idx" ON "public"."user_rate_limits"("windowEnd");

-- CreateIndex
CREATE INDEX "user_rate_limits_isBlocked_blockUntil_idx" ON "public"."user_rate_limits"("isBlocked", "blockUntil");

-- CreateIndex
CREATE INDEX "user_rate_limits_lastRequest_idx" ON "public"."user_rate_limits"("lastRequest");

-- CreateIndex
CREATE UNIQUE INDEX "user_rate_limits_userUuid_ipAddress_endpoint_method_windowS_key" ON "public"."user_rate_limits"("userUuid", "ipAddress", "endpoint", "method", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "user_security_events_uuid_key" ON "public"."user_security_events"("uuid");

-- CreateIndex
CREATE INDEX "user_security_events_userUuid_idx" ON "public"."user_security_events"("userUuid");

-- CreateIndex
CREATE INDEX "user_security_events_eventType_idx" ON "public"."user_security_events"("eventType");

-- CreateIndex
CREATE INDEX "user_security_events_severity_idx" ON "public"."user_security_events"("severity");

-- CreateIndex
CREATE INDEX "user_security_events_ipAddress_idx" ON "public"."user_security_events"("ipAddress");

-- CreateIndex
CREATE INDEX "user_security_events_createdAt_idx" ON "public"."user_security_events"("createdAt");

-- CreateIndex
CREATE INDEX "user_security_events_riskScore_idx" ON "public"."user_security_events"("riskScore");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_uuid_key" ON "public"."user_sessions"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_jti_key" ON "public"."user_sessions"("jti");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshJti_key" ON "public"."user_sessions"("refreshJti");

-- CreateIndex
CREATE INDEX "user_sessions_userUuid_idx" ON "public"."user_sessions"("userUuid");

-- CreateIndex
CREATE INDEX "user_sessions_jti_idx" ON "public"."user_sessions"("jti");

-- CreateIndex
CREATE INDEX "user_sessions_refreshJti_idx" ON "public"."user_sessions"("refreshJti");

-- CreateIndex
CREATE INDEX "user_sessions_familyId_idx" ON "public"."user_sessions"("familyId");

-- CreateIndex
CREATE INDEX "user_sessions_deviceId_idx" ON "public"."user_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "user_sessions_isActive_expiresAt_idx" ON "public"."user_sessions"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_isCompromised_idx" ON "public"."user_sessions"("isCompromised");

-- CreateIndex
CREATE INDEX "user_sessions_lastUsedAt_idx" ON "public"."user_sessions"("lastUsedAt");

-- CreateIndex
CREATE INDEX "user_sessions_deletedAt_idx" ON "public"."user_sessions"("deletedAt");

-- CreateIndex
CREATE INDEX "user_sessions_accessTokenExpiresAt_idx" ON "public"."user_sessions"("accessTokenExpiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_refreshTokenExpiresAt_idx" ON "public"."user_sessions"("refreshTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_refresh_tokens_uuid_key" ON "public"."user_refresh_tokens"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_refresh_tokens_jti_key" ON "public"."user_refresh_tokens"("jti");

-- CreateIndex
CREATE UNIQUE INDEX "user_refresh_tokens_tokenHash_key" ON "public"."user_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_userUuid_idx" ON "public"."user_refresh_tokens"("userUuid");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_jti_idx" ON "public"."user_refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_familyId_idx" ON "public"."user_refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_generation_idx" ON "public"."user_refresh_tokens"("generation");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_tokenHash_idx" ON "public"."user_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_deviceId_idx" ON "public"."user_refresh_tokens"("deviceId");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_isRevoked_isUsed_expiresAt_idx" ON "public"."user_refresh_tokens"("isRevoked", "isUsed", "expiresAt");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_parentJti_idx" ON "public"."user_refresh_tokens"("parentJti");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_deletedAt_idx" ON "public"."user_refresh_tokens"("deletedAt");

-- CreateIndex
CREATE INDEX "user_refresh_tokens_createdAt_idx" ON "public"."user_refresh_tokens"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_audit_logs_uuid_key" ON "public"."user_audit_logs"("uuid");

-- CreateIndex
CREATE INDEX "user_audit_logs_userUuid_idx" ON "public"."user_audit_logs"("userUuid");

-- CreateIndex
CREATE INDEX "user_audit_logs_action_idx" ON "public"."user_audit_logs"("action");

-- CreateIndex
CREATE INDEX "user_audit_logs_resource_resourceId_idx" ON "public"."user_audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "user_audit_logs_createdAt_idx" ON "public"."user_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "user_audit_logs_deletedAt_idx" ON "public"."user_audit_logs"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_jwt_configs_configName_key" ON "public"."user_jwt_configs"("configName");

-- CreateIndex
CREATE INDEX "user_jwt_configs_configName_idx" ON "public"."user_jwt_configs"("configName");

-- CreateIndex
CREATE INDEX "user_jwt_configs_isActive_idx" ON "public"."user_jwt_configs"("isActive");

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

-- CreateIndex
CREATE UNIQUE INDEX "site_menu_group_keys_uuid_key" ON "public"."site_menu_group_keys"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "site_menu_group_keys_key_key" ON "public"."site_menu_group_keys"("key");

-- CreateIndex
CREATE INDEX "site_menu_group_keys_key_idx" ON "public"."site_menu_group_keys"("key");

-- CreateIndex
CREATE INDEX "site_menu_group_keys_uuid_idx" ON "public"."site_menu_group_keys"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "site_menus_uuid_key" ON "public"."site_menus"("uuid");

-- CreateIndex
CREATE INDEX "site_menus_uuid_idx" ON "public"."site_menus"("uuid");

-- CreateIndex
CREATE INDEX "site_menus_groupKeyUuid_idx" ON "public"."site_menus"("groupKeyUuid");

-- CreateIndex
CREATE INDEX "site_menus_parentUUID_idx" ON "public"."site_menus"("parentUUID");

-- CreateIndex
CREATE INDEX "site_menus_type_idx" ON "public"."site_menus"("type");

-- CreateIndex
CREATE INDEX "site_menus_deletedAt_idx" ON "public"."site_menus"("deletedAt");

-- CreateIndex
CREATE INDEX "site_menus_createdAt_idx" ON "public"."site_menus"("createdAt");

-- CreateIndex
CREATE INDEX "site_menus_isPublic_idx" ON "public"."site_menus"("isPublic");

-- CreateIndex
CREATE INDEX "site_menus_requireLogin_idx" ON "public"."site_menus"("requireLogin");

-- CreateIndex
CREATE INDEX "site_menus_displayOrder_idx" ON "public"."site_menus"("displayOrder");

-- CreateIndex
CREATE INDEX "site_menus_groupKeyUuid_parentUUID_idx" ON "public"."site_menus"("groupKeyUuid", "parentUUID");

-- CreateIndex
CREATE INDEX "site_menus_groupKeyUuid_displayOrder_idx" ON "public"."site_menus"("groupKeyUuid", "displayOrder");

-- CreateIndex
CREATE INDEX "site_menus_isPublic_requireLogin_idx" ON "public"."site_menus"("isPublic", "requireLogin");

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
CREATE UNIQUE INDEX "posts_uuid_key" ON "public"."posts"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "public"."posts"("slug");

-- CreateIndex
CREATE INDEX "posts_uuid_idx" ON "public"."posts"("uuid");

-- CreateIndex
CREATE INDEX "posts_slug_idx" ON "public"."posts"("slug");

-- CreateIndex
CREATE INDEX "posts_authorUuid_idx" ON "public"."posts"("authorUuid");

-- CreateIndex
CREATE INDEX "posts_postType_idx" ON "public"."posts"("postType");

-- CreateIndex
CREATE INDEX "posts_postStatus_idx" ON "public"."posts"("postStatus");

-- CreateIndex
CREATE INDEX "posts_parentUuid_idx" ON "public"."posts"("parentUuid");

-- CreateIndex
CREATE INDEX "posts_publishedAt_idx" ON "public"."posts"("publishedAt");

-- CreateIndex
CREATE INDEX "posts_deletedAt_idx" ON "public"."posts"("deletedAt");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "public"."posts"("createdAt");

-- CreateIndex
CREATE INDEX "posts_postType_postStatus_idx" ON "public"."posts"("postType", "postStatus");

-- CreateIndex
CREATE INDEX "posts_postStatus_publishedAt_idx" ON "public"."posts"("postStatus", "publishedAt");

-- CreateIndex
CREATE INDEX "posts_authorUuid_postType_idx" ON "public"."posts"("authorUuid", "postType");

-- CreateIndex
CREATE INDEX "posts_viewCount_idx" ON "public"."posts"("viewCount");

-- CreateIndex
CREATE INDEX "posts_featuredImage_idx" ON "public"."posts"("featuredImage");

-- CreateIndex
CREATE UNIQUE INDEX "post_meta_uuid_key" ON "public"."post_meta"("uuid");

-- CreateIndex
CREATE INDEX "post_meta_postUuid_idx" ON "public"."post_meta"("postUuid");

-- CreateIndex
CREATE INDEX "post_meta_metaKey_idx" ON "public"."post_meta"("metaKey");

-- CreateIndex
CREATE INDEX "post_meta_postUuid_metaKey_idx" ON "public"."post_meta"("postUuid", "metaKey");

-- CreateIndex
CREATE UNIQUE INDEX "terms_uuid_key" ON "public"."terms"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "terms_slug_key" ON "public"."terms"("slug");

-- CreateIndex
CREATE INDEX "terms_name_idx" ON "public"."terms"("name");

-- CreateIndex
CREATE INDEX "terms_slug_idx" ON "public"."terms"("slug");

-- CreateIndex
CREATE INDEX "terms_deletedAt_idx" ON "public"."terms"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "term_taxonomy_uuid_key" ON "public"."term_taxonomy"("uuid");

-- CreateIndex
CREATE INDEX "term_taxonomy_termUuid_idx" ON "public"."term_taxonomy"("termUuid");

-- CreateIndex
CREATE INDEX "term_taxonomy_taxonomy_idx" ON "public"."term_taxonomy"("taxonomy");

-- CreateIndex
CREATE INDEX "term_taxonomy_parentUuid_idx" ON "public"."term_taxonomy"("parentUuid");

-- CreateIndex
CREATE INDEX "term_taxonomy_taxonomy_parentUuid_idx" ON "public"."term_taxonomy"("taxonomy", "parentUuid");

-- CreateIndex
CREATE UNIQUE INDEX "term_taxonomy_termUuid_taxonomy_key" ON "public"."term_taxonomy"("termUuid", "taxonomy");

-- CreateIndex
CREATE INDEX "post_taxonomy_postUuid_idx" ON "public"."post_taxonomy"("postUuid");

-- CreateIndex
CREATE INDEX "post_taxonomy_termTaxonomyUuid_idx" ON "public"."post_taxonomy"("termTaxonomyUuid");

-- CreateIndex
CREATE UNIQUE INDEX "post_taxonomy_postUuid_termTaxonomyUuid_key" ON "public"."post_taxonomy"("postUuid", "termTaxonomyUuid");

-- CreateIndex
CREATE UNIQUE INDEX "comments_uuid_key" ON "public"."comments"("uuid");

-- CreateIndex
CREATE INDEX "comments_postUuid_idx" ON "public"."comments"("postUuid");

-- CreateIndex
CREATE INDEX "comments_parentUuid_idx" ON "public"."comments"("parentUuid");

-- CreateIndex
CREATE INDEX "comments_authorUuid_idx" ON "public"."comments"("authorUuid");

-- CreateIndex
CREATE INDEX "comments_isApproved_idx" ON "public"."comments"("isApproved");

-- CreateIndex
CREATE INDEX "comments_isSpam_idx" ON "public"."comments"("isSpam");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "public"."comments"("createdAt");

-- CreateIndex
CREATE INDEX "comments_deletedAt_idx" ON "public"."comments"("deletedAt");

-- CreateIndex
CREATE INDEX "comments_postUuid_isApproved_idx" ON "public"."comments"("postUuid", "isApproved");

-- CreateIndex
CREATE INDEX "comments_authorIp_idx" ON "public"."comments"("authorIp");

-- CreateIndex
CREATE UNIQUE INDEX "post_revisions_uuid_key" ON "public"."post_revisions"("uuid");

-- CreateIndex
CREATE INDEX "post_revisions_postUuid_idx" ON "public"."post_revisions"("postUuid");

-- CreateIndex
CREATE INDEX "post_revisions_authorUuid_idx" ON "public"."post_revisions"("authorUuid");

-- CreateIndex
CREATE INDEX "post_revisions_revisionNumber_idx" ON "public"."post_revisions"("revisionNumber");

-- CreateIndex
CREATE INDEX "post_revisions_createdAt_idx" ON "public"."post_revisions"("createdAt");

-- CreateIndex
CREATE INDEX "post_revisions_postUuid_revisionNumber_idx" ON "public"."post_revisions"("postUuid", "revisionNumber");

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_roleUuid_fkey" FOREIGN KEY ("roleUuid") REFERENCES "public"."roles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleUuid_fkey" FOREIGN KEY ("roleUuid") REFERENCES "public"."roles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionUuid_fkey" FOREIGN KEY ("permissionUuid") REFERENCES "public"."permissions"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_permissionUuid_fkey" FOREIGN KEY ("permissionUuid") REFERENCES "public"."permissions"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_token_blacklist" ADD CONSTRAINT "user_token_blacklist_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_rate_limits" ADD CONSTRAINT "user_rate_limits_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_security_events" ADD CONSTRAINT "user_security_events_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_refresh_tokens" ADD CONSTRAINT "user_refresh_tokens_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_refresh_tokens" ADD CONSTRAINT "user_refresh_tokens_revokedByUserUuid_fkey" FOREIGN KEY ("revokedByUserUuid") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_audit_logs" ADD CONSTRAINT "user_audit_logs_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_accessPermissionUuid_fkey" FOREIGN KEY ("accessPermissionUuid") REFERENCES "public"."permissions"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_storageUuid_fkey" FOREIGN KEY ("storageUuid") REFERENCES "public"."object_storages"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menus" ADD CONSTRAINT "site_menus_groupKeyUuid_fkey" FOREIGN KEY ("groupKeyUuid") REFERENCES "public"."site_menu_group_keys"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menus" ADD CONSTRAINT "site_menus_parentUUID_fkey" FOREIGN KEY ("parentUUID") REFERENCES "public"."site_menus"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menu_metadata" ADD CONSTRAINT "site_menu_metadata_menuUuid_fkey" FOREIGN KEY ("menuUuid") REFERENCES "public"."site_menus"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menu_roles" ADD CONSTRAINT "site_menu_roles_menuUuid_fkey" FOREIGN KEY ("menuUuid") REFERENCES "public"."site_menus"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_menu_roles" ADD CONSTRAINT "site_menu_roles_roleUuid_fkey" FOREIGN KEY ("roleUuid") REFERENCES "public"."roles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_authorUuid_fkey" FOREIGN KEY ("authorUuid") REFERENCES "public"."users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_parentUuid_fkey" FOREIGN KEY ("parentUuid") REFERENCES "public"."posts"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_meta" ADD CONSTRAINT "post_meta_postUuid_fkey" FOREIGN KEY ("postUuid") REFERENCES "public"."posts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."term_taxonomy" ADD CONSTRAINT "term_taxonomy_termUuid_fkey" FOREIGN KEY ("termUuid") REFERENCES "public"."terms"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."term_taxonomy" ADD CONSTRAINT "term_taxonomy_parentUuid_fkey" FOREIGN KEY ("parentUuid") REFERENCES "public"."term_taxonomy"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_taxonomy" ADD CONSTRAINT "post_taxonomy_postUuid_fkey" FOREIGN KEY ("postUuid") REFERENCES "public"."posts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_taxonomy" ADD CONSTRAINT "post_taxonomy_termTaxonomyUuid_fkey" FOREIGN KEY ("termTaxonomyUuid") REFERENCES "public"."term_taxonomy"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_postUuid_fkey" FOREIGN KEY ("postUuid") REFERENCES "public"."posts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_authorUuid_fkey" FOREIGN KEY ("authorUuid") REFERENCES "public"."users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_parentUuid_fkey" FOREIGN KEY ("parentUuid") REFERENCES "public"."comments"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_revisions" ADD CONSTRAINT "post_revisions_postUuid_fkey" FOREIGN KEY ("postUuid") REFERENCES "public"."posts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_revisions" ADD CONSTRAINT "post_revisions_authorUuid_fkey" FOREIGN KEY ("authorUuid") REFERENCES "public"."users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
