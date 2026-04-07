import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { optionalAuth, requireAuth, authRateLimiter } from '../../middleware';
import {
  register,
  login,
  logout,
  getMe,
  createApiToken,
  listApiTokens,
  revokeApiToken,
  getProfile,
  updateProfile,
  changePassword,
} from './auth.controller';
import { oauthRedirect, oauthCallback } from './oauth.controller';

export const authRouter: IRouter = Router();

// Public routes
authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);

// OAuth routes (public)
authRouter.get('/oauth/:provider', authRateLimiter, oauthRedirect);
authRouter.get('/oauth/:provider/callback', oauthCallback);

// Authenticated routes
authRouter.use(optionalAuth);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, getMe);

// API token management
authRouter.post('/tokens', requireAuth, createApiToken);
authRouter.get('/tokens', requireAuth, listApiTokens);
authRouter.delete('/tokens/:id', requireAuth, revokeApiToken);

// Profile management
authRouter.get('/profile', requireAuth, getProfile);
authRouter.patch('/profile', requireAuth, updateProfile);
authRouter.post('/profile/password', requireAuth, changePassword);
