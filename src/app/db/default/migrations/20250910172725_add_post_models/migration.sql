-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('POST', 'PAGE', 'ATTACHMENT', 'REVISION', 'CUSTOM_POST', 'PRODUCT', 'EVENT', 'GALLERY', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."PostStatus" AS ENUM ('PUBLISH', 'DRAFT', 'PRIVATE', 'PENDING', 'TRASH', 'AUTO_DRAFT', 'INHERIT', 'FUTURE');

-- CreateEnum
CREATE TYPE "public"."CommentStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."PingStatus" AS ENUM ('OPEN', 'CLOSED');

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
