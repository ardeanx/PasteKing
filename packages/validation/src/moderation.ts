import { z } from 'zod';
import {
  ReportReason,
  ReportStatus,
  ModerationAction,
  UserStatus,
} from '@pasteking/types';

// ─── Report schemas ──────────────────────────────────────────────────────────

export const createReportSchema = z.object({
  pasteId: z.string().min(1, 'Paste ID is required'),
  reason: z.enum([
    ReportReason.SPAM,
    ReportReason.MALWARE_OR_PHISHING,
    ReportReason.CREDENTIAL_OR_SECRET_EXPOSURE,
    ReportReason.ILLEGAL_OR_HARMFUL_CONTENT,
    ReportReason.HARASSMENT_OR_ABUSE,
    ReportReason.COPYRIGHT_OR_SENSITIVE_MATERIAL,
    ReportReason.OTHER,
  ]),
  description: z.string().max(2000).optional(),
});

export type CreateReportSchema = z.infer<typeof createReportSchema>;

export const updateReportStatusSchema = z.object({
  status: z.enum([
    ReportStatus.OPEN,
    ReportStatus.UNDER_REVIEW,
    ReportStatus.RESOLVED_NO_ACTION,
    ReportStatus.RESOLVED_CONTENT_REMOVED,
    ReportStatus.RESOLVED_USER_ACTION,
    ReportStatus.REJECTED,
  ]),
  reviewNote: z.string().max(2000).optional(),
});

export type UpdateReportStatusSchema = z.infer<typeof updateReportStatusSchema>;

// ─── Moderation action schemas ───────────────────────────────────────────────

export const moderationActionSchema = z.object({
  action: z.enum([
    ModerationAction.NO_ACTION,
    ModerationAction.HIDE_CONTENT,
    ModerationAction.DISABLE_ACCESS,
    ModerationAction.DELETE_CONTENT,
  ]),
  reason: z.string().max(2000).optional(),
});

export type ModerationActionSchema = z.infer<typeof moderationActionSchema>;

// ─── User status schemas ─────────────────────────────────────────────────────

export const updateUserStatusSchema = z.object({
  status: z.enum([
    UserStatus.ACTIVE,
    UserStatus.RESTRICTED,
    UserStatus.SUSPENDED,
  ]),
  reason: z.string().max(2000).optional(),
});

export type UpdateUserStatusSchema = z.infer<typeof updateUserStatusSchema>;
