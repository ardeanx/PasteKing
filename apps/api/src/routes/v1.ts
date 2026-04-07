import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { healthRouter } from '../modules/health';
import { pastesRouter } from '../modules/pastes';
import { authRouter } from '../modules/auth';
import { reportsRouter, adminRouter } from '../modules/moderation';
import {
  getPublicBranding,
  getPublicSeoSettings,
} from '../modules/moderation/moderation.controller';
import { workspacesRouter } from '../modules/workspaces';
import { billingRouter } from '../modules/billing';

export const v1Router: IRouter = Router();

v1Router.use('/', healthRouter);
v1Router.use('/pastes', pastesRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/admin', adminRouter);
v1Router.get('/settings/branding', getPublicBranding);
v1Router.get('/settings/seo', getPublicSeoSettings);
v1Router.use('/workspaces', workspacesRouter);
v1Router.use('/billing', billingRouter);
