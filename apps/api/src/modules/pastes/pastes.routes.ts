import { Router } from 'express';
import type { Router as IRouter } from 'express';
import {
  createPasteRateLimiter,
  optionalAuth,
  requireAuth,
  enforceUserStatus,
  enforceCreateRestriction,
} from '../../middleware';
import {
  createPaste,
  getPaste,
  getPasteRaw,
  updatePaste,
  deletePaste,
  getRevisions,
  listMyPastes,
  createRawPaste,
  forkPaste,
  searchPastes,
  searchMyPastes,
  getPasteAnalytics,
  getUserAnalytics,
  getRevisionDiff,
  listRecentPublic,
} from './pastes.controller';

export const pastesRouter: IRouter = Router();

// Populate req.user when Authorization header or session cookie is present
pastesRouter.use(optionalAuth);

// Dashboard endpoint — list authenticated user's pastes
pastesRouter.get('/mine', requireAuth, listMyPastes);

// Search (public, non-encrypted)
pastesRouter.get('/search', searchPastes);

// Recent public pastes (no search query needed)
pastesRouter.get('/recent', listRecentPublic);

// Personal search (authenticated, user's own pastes)
pastesRouter.get('/search/mine', requireAuth, searchMyPastes);

// Analytics (authenticated)
pastesRouter.get('/analytics/me', requireAuth, getUserAnalytics);

pastesRouter.post(
  '/',
  createPasteRateLimiter,
  enforceUserStatus,
  enforceCreateRestriction,
  createPaste,
);
pastesRouter.post(
  '/raw',
  createPasteRateLimiter,
  enforceUserStatus,
  enforceCreateRestriction,
  createRawPaste,
);
pastesRouter.get('/:id', getPaste);
pastesRouter.get('/:id/raw', getPasteRaw);
pastesRouter.patch('/:id', updatePaste);
pastesRouter.delete('/:id', deletePaste);
pastesRouter.get('/:id/revisions', getRevisions);
pastesRouter.get('/:id/revisions/:from/diff/:to', getRevisionDiff);
pastesRouter.post('/:id/fork', forkPaste);
pastesRouter.get('/:id/analytics', requireAuth, getPasteAnalytics);
