import { env } from 'cloudflare:workers';
import { createSession } from './session-core';
export { clearCookie } from './session-core';
export const getSession = () => createSession(env);
export const makeCookie = (userId: string) => getSession().makeCookie(userId);
export async function getUserId(request: Request): Promise<string | null> {
  try { return await getSession().getUserId(request); } catch { return null; }
}
