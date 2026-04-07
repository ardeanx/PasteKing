import Stripe from 'stripe';
import { env } from '../../env';

type StripeClient = ReturnType<typeof Stripe>;

let stripeInstance: StripeClient | null = null;

/**
 * Get or create the Stripe client.
 * Returns null if STRIPE_SECRET_KEY is not configured.
 */
export function getStripe(): StripeClient | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!stripeInstance) {
    stripeInstance = Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

/**
 * Require Stripe to be configured. Throws if not.
 */
export function requireStripe(): StripeClient {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in environment.');
  }
  return stripe;
}
