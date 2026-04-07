import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';

export async function POST() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const api = createServerApi(`pasteking_session=${session.value}`);

  try {
    const { data } = await api.createPortalSession();
    redirect(data.url);
  } catch {
    redirect('/billing?error=portal_failed');
  }
}
