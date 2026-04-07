-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'HIDDEN', 'DISABLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AbuseFlagType" AS ENUM ('SECRET_DETECTED', 'EXCESSIVE_PASTE_RATE', 'REPEATED_REPORTS', 'SPAM_HEURISTIC');

-- AlterEnum: ReportReason
BEGIN;
CREATE TYPE "ReportReason_new" AS ENUM ('SPAM', 'MALWARE_OR_PHISHING', 'CREDENTIAL_OR_SECRET_EXPOSURE', 'ILLEGAL_OR_HARMFUL_CONTENT', 'HARASSMENT_OR_ABUSE', 'COPYRIGHT_OR_SENSITIVE_MATERIAL', 'OTHER');
ALTER TABLE "reports" ALTER COLUMN "reason" TYPE "ReportReason_new" USING ("reason"::text::"ReportReason_new");
ALTER TYPE "ReportReason" RENAME TO "ReportReason_old";
ALTER TYPE "ReportReason_new" RENAME TO "ReportReason";
DROP TYPE "public"."ReportReason_old";
COMMIT;

-- AlterEnum: ReportStatus
BEGIN;
CREATE TYPE "ReportStatus_new" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_NO_ACTION', 'RESOLVED_CONTENT_REMOVED', 'RESOLVED_USER_ACTION', 'REJECTED');
ALTER TABLE "public"."reports" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "reports" ALTER COLUMN "status" TYPE "ReportStatus_new" USING ("status"::text::"ReportStatus_new");
ALTER TYPE "ReportStatus" RENAME TO "ReportStatus_old";
ALTER TYPE "ReportStatus_new" RENAME TO "ReportStatus";
DROP TYPE "public"."ReportStatus_old";
ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable
ALTER TABLE "pastes" ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "reports" ADD COLUMN "review_note" TEXT,
ADD COLUMN "reviewed_by" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "platform_role" "PlatformRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "abuse_flags" (
    "id" TEXT NOT NULL,
    "type" "AbuseFlagType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "paste_id" TEXT,
    "user_id" TEXT,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "abuse_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moderation_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abuse_flags_type_idx" ON "abuse_flags"("type");
CREATE INDEX "abuse_flags_resolved_idx" ON "abuse_flags"("resolved");
CREATE INDEX "abuse_flags_paste_id_idx" ON "abuse_flags"("paste_id");
CREATE INDEX "abuse_flags_user_id_idx" ON "abuse_flags"("user_id");

-- CreateIndex
CREATE INDEX "moderation_audit_logs_entity_type_entity_id_idx" ON "moderation_audit_logs"("entity_type", "entity_id");
CREATE INDEX "moderation_audit_logs_actor_id_idx" ON "moderation_audit_logs"("actor_id");
CREATE INDEX "moderation_audit_logs_created_at_idx" ON "moderation_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "pastes_moderation_status_idx" ON "pastes"("moderation_status");

-- CreateIndex (unique constraint for duplicate report prevention)
CREATE UNIQUE INDEX "reports_paste_id_reporter_id_key" ON "reports"("paste_id", "reporter_id");

-- AddForeignKey
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_paste_id_fkey" FOREIGN KEY ("paste_id") REFERENCES "pastes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "moderation_audit_logs" ADD CONSTRAINT "moderation_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
