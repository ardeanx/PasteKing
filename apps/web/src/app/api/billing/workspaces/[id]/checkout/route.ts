import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const formData = await request.formData();
  const planId = formData.get('planId') as string;
  if (!planId) redirect(`/workspaces/${id}?error=missing_plan`);

  const api = createServerApi(`pasteking_session=${session.value}`);

  try {
    const { data } = await api.createWorkspaceCheckoutSession(id, planId);
    redirect(data.url);
  } catch {
    redirect(`/workspaces/${id}?error=checkout_failed`);
  }
}
