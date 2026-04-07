import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerApi } from '@/lib/api';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const formData = await request.formData();
  const planId = formData.get('planId') as string;
  if (!planId) redirect('/billing?error=missing_plan');

  const api = createServerApi(`pasteking_session=${session.value}`);

  try {
    const { data } = await api.createCheckoutSession(planId);
    redirect(data.url);
  } catch {
    redirect('/billing?error=checkout_failed');
  }
}
