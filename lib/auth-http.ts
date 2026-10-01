export const authJson = (data: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || origin === new URL(request.url).origin);
}
export async function readCode(request: Request): Promise<string> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return '';
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 2048) { await reader.cancel(); return ''; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return typeof data?.code === 'string' && data.code.length <= 256 ? data.code : '';
  } catch { return ''; } finally { reader.releaseLock(); }
}
export const failedLoginDelay = () => new Promise<void>(resolve => setTimeout(resolve, 1200 + crypto.getRandomValues(new Uint32Array(1))[0] % 601));
