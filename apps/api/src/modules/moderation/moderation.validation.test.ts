import { describe, it, expect } from 'vitest';
import {
  createReportSchema,
  updateReportStatusSchema,
  moderationActionSchema,
  updateUserStatusSchema,
} from '@pasteking/validation';

describe('createReportSchema', () => {
  it('accepts valid input', () => {
    const result = createReportSchema.safeParse({
      pasteId: 'abc123',
      reason: 'SPAM',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid reasons', () => {
    const reasons = [
      'SPAM',
      'MALWARE_OR_PHISHING',
      'CREDENTIAL_OR_SECRET_EXPOSURE',
      'ILLEGAL_OR_HARMFUL_CONTENT',
      'HARASSMENT_OR_ABUSE',
      'COPYRIGHT_OR_SENSITIVE_MATERIAL',
      'OTHER',
    ];
    for (const reason of reasons) {
      const result = createReportSchema.safeParse({ pasteId: 'abc', reason });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional description', () => {
    const result = createReportSchema.safeParse({
      pasteId: 'abc123',
      reason: 'SPAM',
      description: 'This is spam content',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing pasteId', () => {
    const result = createReportSchema.safeParse({ reason: 'SPAM' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid reason', () => {
    const result = createReportSchema.safeParse({ pasteId: 'abc', reason: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects description over 2000 chars', () => {
    const result = createReportSchema.safeParse({
      pasteId: 'abc',
      reason: 'SPAM',
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateReportStatusSchema', () => {
  it('accepts valid status', () => {
    for (const status of [
      'OPEN',
      'UNDER_REVIEW',
      'RESOLVED_NO_ACTION',
      'RESOLVED_CONTENT_REMOVED',
      'RESOLVED_USER_ACTION',
      'REJECTED',
    ]) {
      const result = updateReportStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional reviewNote', () => {
    const result = updateReportStatusSchema.safeParse({
      status: 'RESOLVED_NO_ACTION',
      reviewNote: 'No action needed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateReportStatusSchema.safeParse({ status: 'PENDING' });
    expect(result.success).toBe(false);
  });
});

describe('moderationActionSchema', () => {
  it('accepts valid actions', () => {
    for (const action of ['NO_ACTION', 'HIDE_CONTENT', 'DISABLE_ACCESS', 'DELETE_CONTENT']) {
      const result = moderationActionSchema.safeParse({ action });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional reason', () => {
    const result = moderationActionSchema.safeParse({
      action: 'HIDE_CONTENT',
      reason: 'Spam detected',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = moderationActionSchema.safeParse({ action: 'BAN' });
    expect(result.success).toBe(false);
  });
});

describe('updateUserStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const status of ['ACTIVE', 'RESTRICTED', 'SUSPENDED']) {
      const result = updateUserStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional reason', () => {
    const result = updateUserStatusSchema.safeParse({
      status: 'SUSPENDED',
      reason: 'Repeated violations',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateUserStatusSchema.safeParse({ status: 'BANNED' });
    expect(result.success).toBe(false);
  });
});
