import { getDb } from '@/db';
import { getSession } from '@/app/session';
import { authJson, sameOrigin, readCode, failedLoginDelay } from '@/lib/auth-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return authJson({ error: 'Недопустимый запрос' }, 403);
  try {
    const session = getSession();
    const db = getDb();
    // Trust Cloudflare's edge-set IP only. Without it, use one shared bucket.
    const ipKey = await session.ipKey(request.headers.get('cf-connecting-ip') || 'unknown');
    const now = Math.floor(Date.now() / 1000);
    await db.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').bind(now).run();
    // Reserve atomically, so parallel requests cannot bypass the limit.
    const slot = await db.prepare(`INSERT INTO login_attempts (ip_key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(ip_key) DO UPDATE SET attempts = login_attempts.attempts + 1
      WHERE login_attempts.attempts < 5 RETURNING expires_at`).bind(ipKey, now + 600).first<{ expires_at: number }>();
    if (!slot) {
      await failedLoginDelay();
      return authJson({ error: 'Слишком много попыток. Попробуйте через 10 минут.' }, 429, { 'Retry-After': '600' });
    }
    const code = await readCode(request);
    const userId = await session.matchCode(code);
    if (!userId) {
      await failedLoginDelay();
      return authJson({ error: 'Неверный код доступа' }, 401);
    }
    const cookie = await session.makeCookie(userId);
    // Successful attempts do not consume the quota or erase previous failures.
    await db.prepare('UPDATE login_attempts SET attempts = MAX(0, attempts - 1) WHERE ip_key = ? AND expires_at = ?').bind(ipKey, slot.expires_at).run();
    return authJson({ ok: true }, 200, { 'Set-Cookie': cookie });
  } catch {
    // Do not log submitted codes, cookies, or secret configuration values.
    return authJson({ error: 'Вход временно недоступен. Обратитесь к владельцу приложения.' }, 503);
  }
}
