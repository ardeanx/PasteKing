import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';
import { ApiError } from '@pasteking/sdk';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; canceled?: string }>;
}

export default async function WorkspaceBillingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  let billing;
  let workspace;
  let plans;
  try {
    [billing, workspace, plans] = await Promise.all([
      api.getWorkspaceBillingStatus(id).then((r) => r.data),
      api.getWorkspace(id).then((r) => r.data),
      api.getPlans().then((r) => r.data),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && (err.status === 403 || err.status === 404))
      redirect('/workspaces');
    throw err;
  }

  const sp = await searchParams;
  const { subscription, usage } = billing;
  const isOwner = workspace.role === 'OWNER';

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const statusColors: Record<string, string> = {
    FREE: 'text-[var(--muted)]',
    ACTIVE: 'text-green-600',
    TRIALING: 'text-blue-600',
    PAST_DUE: 'text-yellow-600',
    CANCELED: 'text-red-600',
    UNPAID: 'text-red-600',
    INCOMPLETE: 'text-yellow-600',
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <a
          href={`/workspaces/${id}`}
          className="text-sm text-[var(--muted)] hover:text-[var(--fg)] no-underline"
        >
          &larr; Back to workspace
        </a>
      </div>

      <h1 className="text-2xl font-bold mb-1">Workspace Billing</h1>
      <p className="text-sm text-[var(--muted)] mb-6">{workspace.name}</p>

      {sp.success && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Workspace subscription activated!
        </div>
      )}
      {sp.canceled && (
        <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          Checkout was canceled.
        </div>
      )}

      {/* Plan */}
      <section className="mb-8 rounded border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--muted)]">Plan:</span>{' '}
            <span className="font-medium">{subscription.planName}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">Status:</span>{' '}
            <span className={`font-medium ${statusColors[subscription.subscriptionStatus] ?? ''}`}>
              {subscription.subscriptionStatus}
            </span>
          </div>
          {subscription.currentPeriodEnd && (
            <div>
              <span className="text-[var(--muted)]">Period ends:</span>{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
          {subscription.cancelAtPeriodEnd && (
            <div className="col-span-2 text-yellow-600 text-sm">
              Will cancel at the end of the billing period.
            </div>
          )}
        </div>
      </section>

      {/* Usage */}
      <section className="mb-8 rounded border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Usage</h2>
        <div className="space-y-3 text-sm">
          <UsageRow
            label="Storage"
            current={formatBytes(usage.storageBytes)}
            limit={formatBytes(subscription.entitlements.maxWorkspaceStorageBytes)}
            ratio={usage.storageBytes / subscription.entitlements.maxWorkspaceStorageBytes}
          />
          <UsageRow
            label="Members"
            current={String(usage.memberCount)}
            limit={String(subscription.entitlements.maxWorkspaceMembers)}
            ratio={usage.memberCount / subscription.entitlements.maxWorkspaceMembers}
          />
          <div className="pt-2 text-xs text-[var(--muted)]">
            Max paste size: {formatBytes(subscription.entitlements.maxPasteSizeBytes)}
          </div>
        </div>
      </section>

      {/* Actions (owner only) */}
      {isOwner && (
        <section className="flex gap-3">
          {subscription.subscriptionStatus === 'FREE' &&
            plans
              .filter((p) => p.id !== 'free')
              .map((p) => (
                <form key={p.id} action={`/api/billing/workspaces/${id}/checkout`} method="POST">
                  <input type="hidden" name="planId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                  >
                    Upgrade to {p.name}
                  </button>
                </form>
              ))}
          {subscription.subscriptionStatus !== 'FREE' && (
            <form action={`/api/billing/workspaces/${id}/portal`} method="POST">
              <button
                type="submit"
                className="rounded border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]"
              >
                Manage Billing
              </button>
            </form>
          )}
        </section>
      )}
      {!isOwner && (
        <p className="text-sm text-[var(--muted)]">Only the workspace owner can manage billing.</p>
      )}
    </div>
  );
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
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-[var(--accent)]';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span>{label}</span>
        <span className="text-[var(--muted)]">
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)]">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
