import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['scripts/run-framework.mjs','dev','--host','127.0.0.1','--port','5173'],{stdio:['ignore','pipe','pipe']});
let output='';let started=false;
const timeout=setTimeout(()=>{console.error(output);server.kill('SIGTERM');process.exitCode=1;},60000);
async function run(){
 try{const test=spawn(process.execPath,['tests/clients.integration.mjs'],{stdio:'inherit'});const code=await new Promise(resolve=>test.on('exit',resolve));process.exitCode=code??1;}
 finally{clearTimeout(timeout);server.kill('SIGTERM');}
}
for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{output+=chunk; if(!started&&output.includes('Local:')){started=true;void run();}});
server.on('exit',code=>{clearTimeout(timeout);if(!started){console.error(output);process.exitCode=code||1;}});
