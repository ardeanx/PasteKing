import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  let billingStatus;
  let plans;
  try {
    const [billingRes, plansRes] = await Promise.all([api.getBillingStatus(), api.getPlans()]);
    billingStatus = billingRes.data;
    plans = plansRes.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  const params = await searchParams;
  const { subscription, usage } = billingStatus;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Billing</h1>

      {params.success && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--success) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--success)',
            marginBottom: 16,
          }}
        >
          Subscription activated successfully!
        </div>
      )}
      {params.canceled && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--warning)',
            marginBottom: 16,
          }}
        >
          Checkout was canceled. You can try again anytime.
        </div>
      )}

      {/* Current Plan */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Current Plan</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--muted)' }}>Plan:</span>{' '}
            <span style={{ fontWeight: 500 }}>{subscription.planName}</span>
          </div>
          <div>
            <span style={{ color: 'var(--muted)' }}>Status:</span>{' '}
            <span style={{ fontWeight: 500, color: statusColor(subscription.subscriptionStatus) }}>
              {subscription.subscriptionStatus}
            </span>
          </div>
          {subscription.currentPeriodEnd && (
            <div>
              <span style={{ color: 'var(--muted)' }}>Period ends:</span>{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
          {subscription.cancelAtPeriodEnd && (
            <div style={{ gridColumn: 'span 2', color: 'var(--warning)', fontSize: 13 }}>
              Your plan will cancel at the end of the billing period.
            </div>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Usage</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <UsageRow
            label="Storage"
            current={formatBytes(usage.personalStorageBytes)}
            limit={formatBytes(subscription.entitlements.maxPersonalStorageBytes)}
            ratio={usage.personalStorageBytes / subscription.entitlements.maxPersonalStorageBytes}
          />
          <UsageRow
            label="Active Pastes"
            current={String(usage.personalActivePastes)}
            limit={String(subscription.entitlements.maxPersonalActivePastes)}
            ratio={usage.personalActivePastes / subscription.entitlements.maxPersonalActivePastes}
          />
          <UsageRow
            label="API Tokens"
            current={String(usage.activeApiTokens)}
            limit={String(subscription.entitlements.maxActiveApiTokens)}
            ratio={usage.activeApiTokens / subscription.entitlements.maxActiveApiTokens}
          />
          <UsageRow
            label="Workspaces Owned"
            current={String(usage.workspacesOwned)}
            limit={String(subscription.entitlements.maxWorkspacesOwned)}
            ratio={usage.workspacesOwned / subscription.entitlements.maxWorkspacesOwned}
          />
          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
            Max paste size: {formatBytes(subscription.entitlements.maxPasteSizeBytes)} · Max raw
            upload: {formatBytes(subscription.entitlements.maxRawUploadSizeBytes)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        {subscription.subscriptionStatus === 'FREE' && (
          <>
            {plans
              .filter((p: { id: string }) => p.id !== 'free')
              .map((p: { id: string; name: string }) => (
                <form key={p.id} action="/api/billing/checkout" method="POST">
                  <input type="hidden" name="planId" value={p.id} />
                  <button type="submit" className="btn-primary" style={{ fontSize: 13 }}>
                    Upgrade to {p.name}
                  </button>
                </form>
              ))}
          </>
        )}
        {subscription.subscriptionStatus !== 'FREE' && (
          <form action="/api/billing/portal" method="POST">
            <button type="submit" className="btn-secondary" style={{ fontSize: 13 }}>
              Manage Billing
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'var(--success)';
    case 'TRIALING':
      return 'var(--accent)';
    case 'PAST_DUE':
    case 'INCOMPLETE':
      return 'var(--warning)';
    case 'CANCELED':
    case 'UNPAID':
      return 'var(--error)';
    default:
      return 'var(--muted)';
  }
}

function UsageRow({
  label,
  current,
  limit,
  ratio,
}: {
  label: string;
  current: string;
  limit: string;
  ratio: number;
}) {
  const pct = Math.min(Number.isFinite(ratio) ? ratio * 100 : 0, 100);
  const barColor = pct >= 90 ? 'var(--error)' : pct >= 70 ? 'var(--warning)' : 'var(--accent)';
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--muted)' }}>
          {current} / {limit}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: barColor,
            width: `${pct}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}
