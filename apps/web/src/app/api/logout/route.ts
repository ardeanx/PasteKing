import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function POST() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');

  if (session?.value) {
    const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `pasteking_session=${session.value}` },
    }).catch(() => {});
  }

  cookieStore.delete('pasteking_session');
  redirect('/');
}
