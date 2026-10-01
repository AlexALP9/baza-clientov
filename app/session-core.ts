// Web Crypto only. This module deliberately has no runtime bindings or Node imports.
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();
type Settings = { ACCESS_CODES?: string; SESSION_SECRET?: string };
type Account = { userId: string; code: string };
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  const bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  if (encode(bytes) !== value) throw new Error('Non-canonical encoding');
  return bytes;
}
export function createSession(settings: Settings) {
  if (typeof settings.SESSION_SECRET !== 'string' || encoder.encode(settings.SESSION_SECRET).length < 32 || typeof settings.ACCESS_CODES !== 'string') throw new Error('Authentication is not configured');
  const accounts: Account[] = settings.ACCESS_CODES.trim() ? settings.ACCESS_CODES.split(',').map(entry => {
    const colon = entry.indexOf(':');
    const userId = entry.slice(0, colon).trim(), code = entry.slice(colon + 1);
    if (colon < 1 || !userId || userId.length > 200 || /[\s:,\x00-\x1f]/.test(userId) || code.length < 12 || code.length > 256 || /[:,\x00-\x1f]/.test(code)) throw new Error('Invalid access code configuration');
    return { userId, code };
  }) : [];
  if (new Set(accounts.map(a => a.userId)).size !== accounts.length || new Set(accounts.map(a => a.code)).size !== accounts.length) throw new Error('Duplicate access code configuration');
  const key = crypto.subtle.importKey('raw', encoder.encode(settings.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sign = async (message: string) => new Uint8Array(await crypto.subtle.sign('HMAC', await key, encoder.encode(message)));
  // Native Web Crypto HMAC verification performs the secret-dependent comparison.
  const verify = async (signature: Uint8Array<ArrayBuffer>, message: string) => crypto.subtle.verify('HMAC', await key, signature, encoder.encode(message));
  const credential = (a: Account) => 'credential:' + JSON.stringify([a.userId, a.code]);
  return {
    async matchCode(code: string): Promise<string | null> {
      const signature = await sign('code:' + code);
      let matched: string | null = null;
      // Compare every account, even after a match; do not reveal its position by an early return.
      for (const account of accounts) if (await verify(signature, 'code:' + account.code)) matched = account.userId;
      return matched;
    },
    async ipKey(ip: string) { return encode(await sign('login-ip:' + ip)); },
    async makeCookie(userId: string, now = Date.now()) {
      const account = accounts.find(a => a.userId === userId);
      if (!account) throw new Error('Unknown user');
      const iat = Math.floor(now / 1000), exp = iat + SESSION_SECONDS;
      const payload = encode(encoder.encode(JSON.stringify({ v: 1, userId, iat, exp, credential: encode(await sign(credential(account))) })));
      const token = payload + '.' + encode(await sign('session:' + payload));
      return `session=${token}; Max-Age=${SESSION_SECONDS}; Expires=${new Date(exp * 1000).toUTCString()}; HttpOnly; Secure; SameSite=Lax; Path=/`;
    },
    async getUserId(request: Request, now = Date.now()): Promise<string | null> {
      try {
        const cookies = (request.headers.get('cookie') || '').split(';').map(c => c.trim()).filter(c => c.startsWith('session='));
        if (cookies.length !== 1) return null;
        const token = cookies[0].slice(8);
        if (token.length > 2048) return null;
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const [payload, signature] = parts;
        const sig = decode(signature);
        if (sig.length !== 32 || !await verify(sig, 'session:' + payload)) return null;
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(payload)));
        const seconds = Math.floor(now / 1000);
        if (data.v !== 1 || typeof data.userId !== 'string' || !Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp) || data.iat > seconds || data.exp <= seconds || data.exp - data.iat !== SESSION_SECONDS || typeof data.credential !== 'string') return null;
        const account = accounts.find(a => a.userId === data.userId);
        // Revoking or changing this person's code invalidates their existing cookies too.
        if (!account || !await verify(decode(data.credential), credential(account))) return null;
        return data.userId;
      } catch { return null; }
    },
  };
}
export const clearCookie = () => 'session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax; Path=/';
