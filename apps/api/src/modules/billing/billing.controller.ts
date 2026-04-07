import type { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { getAllPlans } from './plans';

const billingService = new BillingService();

export async function getPlans(_req: Request, res: Response): Promise<void> {
  const plans = getAllPlans().map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    entitlements: p.entitlements,
  }));
  res.json({ success: true, data: plans });
}

export async function getPersonalBillingStatus(req: Request, res: Response): Promise<void> {
  const status = await billingService.getPersonalBillingStatus(req.user!.id);
  res.json({ success: true, data: status });
}

export async function createPersonalCheckout(req: Request, res: Response): Promise<void> {
  const { planId } = (req.body ?? {}) as { planId: string };
  if (!planId) {
    res
      .status(400)
      .json({ success: false, error: { code: 'BAD_REQUEST', message: 'planId required' } });
    return;
  }
  const session = await billingService.createPersonalCheckoutSession(
    req.user!.id,
    planId as 'pro' | 'team',
  );
  res.json({ success: true, data: session });
}

export async function createPersonalPortal(req: Request, res: Response): Promise<void> {
  const session = await billingService.createPersonalPortalSession(req.user!.id);
  res.json({ success: true, data: session });
}

export async function getWorkspaceBillingStatus(req: Request, res: Response): Promise<void> {
  const status = await billingService.getWorkspaceBillingStatus(req.params['id'] as string);
  res.json({ success: true, data: status });
}

export async function createWorkspaceCheckout(req: Request, res: Response): Promise<void> {
  const { planId } = (req.body ?? {}) as { planId: string };
  if (!planId) {
    res
      .status(400)
      .json({ success: false, error: { code: 'BAD_REQUEST', message: 'planId required' } });
    return;
  }
  const session = await billingService.createWorkspaceCheckoutSession(
    req.params['id'] as string,
    req.user!.id,
    planId as 'pro' | 'team',
  );
  res.json({ success: true, data: session });
}

export async function createWorkspacePortal(req: Request, res: Response): Promise<void> {
  const session = await billingService.createWorkspacePortalSession(
    req.params['id'] as string,
    req.user!.id,
  );
  res.json({ success: true, data: session });
}

export async function adminGetUserBilling(req: Request, res: Response): Promise<void> {
  const summary = await billingService.getAdminUserBillingSummary(req.params['id'] as string);
  res.json({ success: true, data: summary });
}

export async function adminGetWorkspaceBilling(req: Request, res: Response): Promise<void> {
  const summary = await billingService.getAdminWorkspaceBillingSummary(req.params['id'] as string);
  res.json({ success: true, data: summary });
}

export async function adminReconcileUser(req: Request, res: Response): Promise<void> {
  await billingService.reconcileUser(req.params['id'] as string);
  res.json({ success: true, data: { reconciled: true } });
}

export async function adminReconcileWorkspace(req: Request, res: Response): Promise<void> {
  await billingService.reconcileWorkspace(req.params['id'] as string);
  res.json({ success: true, data: { reconciled: true } });
}
