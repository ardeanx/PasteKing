import { z } from 'zod';
import { WorkspaceRole } from '@pasteking/types';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

export type CreateWorkspaceSchema = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export type UpdateWorkspaceSchema = z.infer<typeof updateWorkspaceSchema>;

export const createInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]).default(WorkspaceRole.MEMBER),
});

export type CreateInviteSchema = z.infer<typeof createInviteSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]),
});

export type UpdateMemberRoleSchema = z.infer<typeof updateMemberRoleSchema>;
