import type { Request, Response } from 'express';
import { prisma } from '@pasteking/db';
import { logger } from '../../logger';
import { getStripe } from './stripe';
import { BillingService } from './billing.service';
import { env } from '../../env';

const billingService = new BillingService();

/**
 * POST /v1/billing/webhook
 *
 * Stripe webhook endpoint. Processes events idempotently.
 * Must receive raw body (not JSON-parsed) for signature verification.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(501).json({ error: 'Stripe webhooks not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn(
      { event: 'webhook_signature_failed', error: (err as Error).message },
      'Stripe webhook signature verification failed',
    );
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  // Idempotency: check if we already processed this event
  const existing = await prisma.billingEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing) {
    logger.info(
      { event: 'webhook_duplicate', stripeEventId: event.id },
      'Duplicate webhook event skipped',
    );
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    await processEvent(event as any);

    // Record processed event
    await prisma.billingEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        subjectType: resolveSubjectType(event as any),
        subjectId: resolveSubjectId(event as any),
        stripeCustomerId: resolveCustomerId(event as any),
        metadata: {
          livemode: event.livemode,
          created: event.created,
        },
      },
    });

    logger.info(
      {
        event: 'webhook_processed',
        stripeEventId: event.id,
        eventType: event.type,
      },
      `Webhook processed: ${event.type}`,
    );
  } catch (err) {
    logger.error(
      {
        event: 'webhook_processing_error',
        stripeEventId: event.id,
        eventType: event.type,
        error: (err as Error).message,
      },
      'Webhook processing error',
    );
    // Still return 200 to prevent Stripe retries for processing errors
    // The event is not recorded, so reconciliation can pick it up
  }

  res.status(200).json({ received: true });
}

async function processEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        mode: string;
        subscription: string;
        customer: string;
        metadata?: Record<string, string>;
        client_reference_id?: string;
      };

      if (session.mode === 'subscription' && session.subscription) {
        const stripe = getStripe()!;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Propagate metadata from checkout to subscription
        const subjectType = session.metadata?.subjectType ?? 'user';
        const subjectId = session.metadata?.subjectId ?? session.client_reference_id;
        const planId = session.metadata?.planId ?? 'pro';

        await stripe.subscriptions.update(session.subscription, {
          metadata: { subjectType, subjectId: subjectId ?? '', planId },
        });

        // Update stripe customer ID on subject
        if (subjectType === 'workspace' && subjectId) {
          await prisma.workspace
            .update({
              where: { id: subjectId },
              data: { stripeCustomerId: session.customer },
            })
            .catch(() => {});
        } else if (subjectId) {
          await prisma.user
            .update({
              where: { id: subjectId },
              data: { stripeCustomerId: session.customer },
            })
            .catch(() => {});
        }

        await billingService.syncSubscriptionFromStripe(subscription as any, subjectType);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const subscription = event.data.object as Parameters<
        typeof billingService.syncSubscriptionFromStripe
      >[0];
      await billingService.syncSubscriptionFromStripe(subscription as any);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as {
        customer: string;
        metadata?: Record<string, string>;
      };
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer as { id: string }).id;
      const subjectType = (subscription.metadata?.subjectType ?? 'user') as 'user' | 'workspace';
      await billingService.revertToFree(subjectType, customerId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as {
        subscription: string;
        customer: string;
      };
      logger.warn(
        {
          event: 'payment_failed',
          subscriptionId: invoice.subscription,
          customerId: invoice.customer,
        },
        'Invoice payment failed',
      );
      // Status will be updated via subscription.updated event (past_due)
      break;
    }

    default:
      logger.debug({ eventType: event.type }, 'Unhandled webhook event type');
  }
}

function resolveSubjectType(event: { data: { object: Record<string, unknown> } }): string {
  const obj = event.data.object;
  const metadata = obj.metadata as Record<string, string> | undefined;
  return metadata?.subjectType ?? 'user';
}

function resolveSubjectId(event: { data: { object: Record<string, unknown> } }): string | null {
  const obj = event.data.object;
  const metadata = obj.metadata as Record<string, string> | undefined;
  return metadata?.subjectId ?? (obj.client_reference_id as string | undefined) ?? null;
}

function resolveCustomerId(event: { data: { object: Record<string, unknown> } }): string | null {
  const obj = event.data.object;
  if (typeof obj.customer === 'string') return obj.customer;
  return null;
}
