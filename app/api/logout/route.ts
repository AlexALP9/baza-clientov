import { clearCookie } from '@/app/session';
import { authJson, sameOrigin } from '@/lib/auth-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return authJson({ error: 'Недопустимый запрос' }, 403);
  return authJson({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
