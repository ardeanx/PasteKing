import { Router } from 'express';
import type { Router as IRouter } from 'express';
import {
  optionalAuth,
  requireAuth,
  requireAdmin,
  enforceUserStatus,
  reportRateLimiter,
} from '../../middleware';
import {
  createReport,
  listReports,
  getReport,
  updateReportStatus,
  getPasteModeration,
  takeModerationAction,
  listUsers,
  getUser,
  updateUserStatus,
  listAbuseFlags,
  listAuditLogs,
  listAllPastes,
  getSiteSettings,
  updateSiteSettings,
} from './moderation.controller';
import { adminSearchPastes } from '../pastes/pastes.controller';

// ─── User-facing report endpoint ─────────────────────────────────────────

export const reportsRouter: IRouter = Router();
reportsRouter.use(optionalAuth);
reportsRouter.post('/', requireAuth, enforceUserStatus, reportRateLimiter, createReport);

// ─── Admin routes (/v1/admin/*) ──────────────────────────────────────────

export const adminRouter: IRouter = Router();
adminRouter.use(optionalAuth, requireAuth, requireAdmin);

// Reports
adminRouter.get('/reports', listReports);
adminRouter.get('/reports/:id', getReport);
adminRouter.patch('/reports/:id', updateReportStatus);

// Paste moderation
adminRouter.get('/pastes/search', adminSearchPastes);
adminRouter.get('/pastes/:id/moderation', getPasteModeration);
adminRouter.post('/pastes/:id/actions', takeModerationAction);

// User management
adminRouter.get('/users', listUsers);
adminRouter.get('/users/:id', getUser);
adminRouter.patch('/users/:id/status', updateUserStatus);

// Abuse flags
adminRouter.get('/flags', listAbuseFlags);

// Audit logs
adminRouter.get('/audit-logs', listAuditLogs);

// All pastes (paginated listing)
adminRouter.get('/pastes', listAllPastes);

// Site settings
adminRouter.get('/settings', getSiteSettings);
adminRouter.patch('/settings', updateSiteSettings);
