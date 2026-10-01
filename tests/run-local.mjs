// Tests use a disposable local Worker and D1/R2; never the deployed database.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=process.cwd(),dir=await mkdtemp(join(tmpdir(),'contact-auth-tests-'));
const codeA=randomBytes(18).toString('hex'),codeB=randomBytes(18).toString('hex'),secret=randomBytes(32).toString('hex');
const codes=`contact-integration-test:${codeA},another-test-user:${codeB}`;
const configPath=join(dir,'wrangler.json'),persist=join(dir,'state');
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const env={...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_LOG_PATH:join(dir,'logs'),TEST_CODE_A:codeA,TEST_CODE_B:codeB,TEST_SESSION_SECRET:secret,TEST_ACCESS_CODES:codes,TEST_ORIGIN:'http://127.0.0.1:5187'};
async function run(args){const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});let output='';for(const s of [child.stdout,child.stderr])s.on('data',c=>output+=c);const code=await new Promise((ok,fail)=>{child.on('exit',ok);child.on('error',fail);});if(code!==0)throw new Error(output.replaceAll(secret,'[test-secret]').replaceAll(codes,'[test-codes]'));return output;}
let server,serverOutput='';
try{
 const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
 config.name='contact-isolated-test';config.main=resolve('dist/server/index.js');config.assets={directory:resolve('dist/client')};config.vars={ACCESS_CODES:codes,SESSION_SECRET:secret};
 config.d1_databases=[{binding:'DB',database_name:'contact-isolated-test',database_id:'00000000-0000-4000-8000-000000000000'}];config.r2_buckets=[{binding:'BUCKET',bucket_name:'contact-isolated-test'}];
 await writeFile(configPath,JSON.stringify(config),{mode:0o600});
 for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())await run([wrangler,'d1','execute','DB','--local','--config',configPath,'--persist-to',persist,'--file',resolve('drizzle',name)]);
 server=spawn(process.execPath,[wrangler,'dev','--local','--config',configPath,'--persist-to',persist,'--ip','127.0.0.1','--port','5187','--inspector-port','0'],{env,stdio:['ignore','pipe','pipe']});
 for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>serverOutput+=chunk);
 let ready=false;
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw new Error('Local Worker exited');
  try{const response=await fetch(env.TEST_ORIGIN+'/api/clients');if(response.status===401){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 if(!ready)throw new Error('Local Worker did not become ready');
 console.log(await run(['--test','tests/session.test.mjs']));
 for(const test of ['tests/auth.integration.mjs','tests/clients.integration.mjs'])console.log(await run([test]));
} catch(error){console.error(String(error).replaceAll(secret,'[test-secret]').replaceAll(codes,'[test-codes]'));console.error(serverOutput.replaceAll(secret,'[test-secret]').replaceAll(codes,'[test-codes]').slice(-5000));process.exitCode=1;}
finally{if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));}await rm(dir,{recursive:true,force:true});process.chdir(root);}
