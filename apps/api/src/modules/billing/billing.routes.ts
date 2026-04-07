import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware';
import {
  getPlans,
  getPersonalBillingStatus,
  createPersonalCheckout,
  createPersonalPortal,
  getWorkspaceBillingStatus,
  createWorkspaceCheckout,
  createWorkspacePortal,
  adminGetUserBilling,
  adminGetWorkspaceBilling,
  adminReconcileUser,
  adminReconcileWorkspace,
} from './billing.controller';

export const billingRouter: Router = Router();

// Public: plan catalog
billingRouter.get('/plans', getPlans);

// Personal billing (auth required)
billingRouter.get('/status', requireAuth, getPersonalBillingStatus);
billingRouter.post('/checkout', requireAuth, createPersonalCheckout);
billingRouter.post('/portal', requireAuth, createPersonalPortal);

// Workspace billing (auth required, owner-enforced in service)
billingRouter.get('/workspaces/:id/status', requireAuth, getWorkspaceBillingStatus);
billingRouter.post('/workspaces/:id/checkout', requireAuth, createWorkspaceCheckout);
billingRouter.post('/workspaces/:id/portal', requireAuth, createWorkspacePortal);

// Admin billing visibility
billingRouter.get('/admin/users/:id', requireAuth, requireAdmin, adminGetUserBilling);
billingRouter.get('/admin/workspaces/:id', requireAuth, requireAdmin, adminGetWorkspaceBilling);
billingRouter.post('/admin/users/:id/reconcile', requireAuth, requireAdmin, adminReconcileUser);
billingRouter.post(
  '/admin/workspaces/:id/reconcile',
  requireAuth,
  requireAdmin,
  adminReconcileWorkspace,
);
