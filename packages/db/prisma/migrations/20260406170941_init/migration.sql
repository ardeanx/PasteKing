-- CreateEnum
CREATE TYPE "PasteMode" AS ENUM ('CODE', 'TEXT', 'LOG', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "PasteVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PasteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'BURNED', 'DELETED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSE', 'ILLEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pastes" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "mode" "PasteMode" NOT NULL DEFAULT 'TEXT',
    "visibility" "PasteVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "PasteStatus" NOT NULL DEFAULT 'ACTIVE',
    "language" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "encryption_iv" TEXT,
    "encryption_version" INTEGER,
    "burn_after_read" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "current_revision" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT,
    "content_ref" TEXT,
    "delete_token_hash" TEXT,
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pastes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paste_revisions" (
    "id" TEXT NOT NULL,
    "paste_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "content" TEXT,
    "content_ref" TEXT,
    "content_hash" TEXT,
    "editor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paste_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "paste_id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pastes_delete_token_hash_key" ON "pastes"("delete_token_hash");

-- CreateIndex
CREATE INDEX "pastes_status_expires_at_idx" ON "pastes"("status", "expires_at");

-- CreateIndex
CREATE INDEX "pastes_author_id_idx" ON "pastes"("author_id");

-- CreateIndex
CREATE INDEX "pastes_visibility_status_idx" ON "pastes"("visibility", "status");

-- CreateIndex
CREATE UNIQUE INDEX "paste_revisions_paste_id_revision_number_key" ON "paste_revisions"("paste_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_prefix_idx" ON "api_tokens"("prefix");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- CreateIndex
CREATE INDEX "reports_paste_id_idx" ON "reports"("paste_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastes" ADD CONSTRAINT "pastes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paste_revisions" ADD CONSTRAINT "paste_revisions_paste_id_fkey" FOREIGN KEY ("paste_id") REFERENCES "pastes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_paste_id_fkey" FOREIGN KEY ("paste_id") REFERENCES "pastes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
