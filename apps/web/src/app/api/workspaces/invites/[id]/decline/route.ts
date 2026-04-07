import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: inviteId } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('pasteking_session');
  if (!session?.value) redirect('/login');

  const formData = await _request.formData();
  const workspaceId = formData.get('workspaceId') as string;

  if (workspaceId) {
    await fetch(`${API_URL}/v1/workspaces/${workspaceId}/invites/${inviteId}/decline`, {
      method: 'POST',
      headers: { Cookie: `pasteking_session=${session.value}` },
    }).catch(() => {});
  }

  redirect('/workspaces');
}
