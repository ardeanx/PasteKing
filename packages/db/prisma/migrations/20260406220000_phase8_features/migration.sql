-- AlterTable: Allow OAuth-only users (no password)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable: Add fork reference to pastes
ALTER TABLE "pastes" ADD COLUMN "forked_from_id" TEXT;

-- CreateTable: OAuth accounts
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Paste view analytics
CREATE TABLE "paste_views" (
    "id" TEXT NOT NULL,
    "paste_id" TEXT NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paste_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_id_key" ON "oauth_accounts"("provider", "provider_id");
CREATE INDEX "paste_views_paste_id_created_at_idx" ON "paste_views"("paste_id", "created_at");
CREATE INDEX "pastes_forked_from_id_idx" ON "pastes"("forked_from_id");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pastes" ADD CONSTRAINT "pastes_forked_from_id_fkey" FOREIGN KEY ("forked_from_id") REFERENCES "pastes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paste_views" ADD CONSTRAINT "paste_views_paste_id_fkey" FOREIGN KEY ("paste_id") REFERENCES "pastes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
