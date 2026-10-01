import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createSession, clearCookie, SESSION_SECONDS } from '../app/session-core.ts';
const secret=randomBytes(32).toString('hex'), a=randomBytes(18).toString('hex'), b=randomBytes(18).toString('hex');
const settings={ACCESS_CODES:`alice:${a},bob:${b}`,SESSION_SECRET:secret};
const auth=createSession(settings), now=Date.now();
const request=token=>new Request('https://example.test/api/clients',{headers:{cookie:token.split(';')[0]}});
test('correct / incorrect codes and all cookie flags',async()=>{
 assert.equal(await auth.matchCode(a),'alice');assert.equal(await auth.matchCode(b),'bob');assert.equal(await auth.matchCode('wrong'),null);
 const cookie=await auth.makeCookie('alice',now);for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=2592000'])assert.ok(cookie.includes(flag));
 assert.equal(await auth.getUserId(request(cookie),now),'alice');assert.ok(!cookie.includes(a));assert.match(clearCookie(),/Max-Age=0/);
});
test('expired, future, forged, malformed and missing cookies rejected',async()=>{
 const cookie=await auth.makeCookie('alice',now);
 assert.equal(await auth.getUserId(request(cookie),now+SESSION_SECONDS*1000),null);
 assert.equal(await auth.getUserId(request(await auth.makeCookie('alice',now+60000)),now),null);
 const [payload,sig]=cookie.split(';')[0].slice(8).split('.');
 const data=JSON.parse(Buffer.from(payload,'base64url'));data.userId='bob';
 assert.equal(await auth.getUserId(request('session='+Buffer.from(JSON.stringify(data)).toString('base64url')+'.'+sig),now),null);
 assert.equal(await auth.getUserId(request('session='+payload+'.'+(sig[0]==='A'?'B':'A')+sig.slice(1)),now),null);
 for(const value of ['session=bad','session=..','session=%00','session='])assert.equal(await auth.getUserId(request(value)),null);
 assert.equal(await auth.getUserId(new Request('https://example.test')),null);
 assert.equal(await auth.getUserId(new Request('https://example.test',{headers:{cookie:cookie.split(';')[0]+'; '+cookie.split(';')[0]}})),null);
});
test('code removal/rotation and signing-secret rotation revoke old sessions',async()=>{
 const cookie=await auth.makeCookie('alice',now);
 for(const config of [{...settings,ACCESS_CODES:`bob:${b}`},{...settings,ACCESS_CODES:`alice:${b}`},{...settings,ACCESS_CODES:''},{...settings,SESSION_SECRET:randomBytes(32).toString('hex')}])assert.equal(await createSession(config).getUserId(request(cookie),now),null);
 assert.equal(await createSession({...settings,ACCESS_CODES:`alice:${a}`}).getUserId(request(cookie),now),'alice');
 assert.throws(()=>createSession({}),/configured/);
 assert.throws(()=>createSession({...settings,ACCESS_CODES:`alice:${a},bob:${a}`}),/Duplicate/);
});
