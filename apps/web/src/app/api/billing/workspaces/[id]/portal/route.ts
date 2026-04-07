import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  try {
    const { data } = await api.createWorkspacePortalSession(id);
    redirect(data.url);
  } catch {
    redirect(`/workspaces/${id}?error=portal_failed`);
  }
}
