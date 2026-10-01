import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankClient,fields,statuses,selectClients,formatCallDate,validateClient} from '../lib/client-model.ts';

const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Use an isolated local server for these tests.');
const identity={'oai-authenticated-user-id':'contact-integration-test','oai-authenticated-user-email':'contact-test@example.test'};
const created=[];
async function request(path='',options={}){return fetch(origin+'/api/clients'+path,{...options,headers:{...identity,...options.headers}});}
async function jsonSave(client,method='POST'){return request('',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(client)});}
async function photoSave(client,{file,remove=false}={}){const body=new FormData();body.set('client',JSON.stringify(client));body.set('removePhoto',String(remove));if(file)body.set('photo',file);return request('',{method:client.id?'PUT':'POST',body});}
const fixture=async(ext,type)=>new File([await readFile(new URL('./fixtures/logo.'+ext,import.meta.url))],'logo.'+ext,{type});
const original={...blankClient(),company:'ТЕСТ · анкета',status:4,website:'https://example.test',region:'Санкт-Петербург',business:'Автопарк',oil:'Есть',brands:'Тестовый бренд',chemistry:'Есть',parts:'Нет',locations:'2',audience:'B2B',potential:'Высокий',interests:'Наличие, Доставка',approach:'Аргумент',objection:'Возражение',response:'Ответ',decisionMaker:'Закупки',contacts:'Тестовый контакт',nextStep:'КП'};
try{
 let r=await jsonSave(original);assert.equal(r.status,201);let c=(await r.json()).client;created.push(c.id);
 assert.equal(c.lastCallDate,'');assert.equal(c.callComment,'');
 c={...c,initials:'Амосов Ф. В.',photoKind:'logo',lastCallDate:'2026-09-01',callComment:'Обсудили ассортимент, договорились направить КП.'};
 r=await photoSave(c,{file:await fixture('png','image/png')});assert.equal(r.status,200);c=(await r.json()).client;const firstPhoto=c.photoKey;assert.ok(firstPhoto);
 for(const [key] of fields.slice(0,18))assert.equal(c[key],original[key],key+' preserved');
 let image=await request('/photo?id='+c.id);assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');assert.match(image.headers.get('Cache-Control'),/private.*no-store/);
 assert.deepEqual(Buffer.from(await image.arrayBuffer()),await readFile(new URL('./fixtures/logo.png',import.meta.url)));
 const independent=await fetch(origin+'/api/clients',{headers:identity,cache:'no-store'});const restored=(await independent.json()).clients.find(x=>x.id===c.id);assert.deepEqual(restored,c);
 console.log('PASS: original 18 fields, image + initials + date/comment survive independent reads');
 r=await photoSave({...c,photoKind:'person',lastCallDate:'2026-09-30',callComment:'КП согласовано'},{file:await fixture('webp','image/webp')});assert.equal(r.status,200);c=(await r.json()).client;assert.notEqual(c.photoKey,firstPhoto);assert.equal(c.initials,'Амосов Ф. В.');
 image=await request('/photo?id='+c.id);assert.equal(image.headers.get('Content-Type'),'image/webp');
 const secondPhoto=c.photoKey;
 r=await photoSave({...c,lastCallDate:'2026-02-30'},{file:await fixture('jpg','image/jpeg')});assert.equal(r.status,400);
 r=await photoSave(c,{file:new File([new Uint8Array(5*1024*1024+1)],'too-large.png',{type:'image/png'})});assert.equal(r.status,413);
 r=await photoSave(c,{file:new File(['GIF89a invalid'],'fake.png',{type:'image/png'})});assert.equal(r.status,400);
 r=await request();assert.equal((await r.json()).clients.find(x=>x.id===c.id).photoKey,secondPhoto);
 r=await photoSave(c,{file:await fixture('jpg','image/jpeg')});assert.equal(r.status,200);c=(await r.json()).client;
 image=await request('/photo?id='+c.id);assert.equal(image.headers.get('Content-Type'),'image/jpeg');
 console.log('PASS: JPG / PNG / WebP, replacement, size/type/date rejection, previous image preserved on failure');
 r=await photoSave(c,{remove:true});assert.equal(r.status,200);c=(await r.json()).client;assert.equal(c.photoKey,'');assert.equal(c.initials,'Амосов Ф. В.');assert.equal(c.lastCallDate,'2026-09-30');assert.equal(c.callComment,'КП согласовано');
 assert.equal((await request('/photo?id='+c.id)).status,404);
 r=await photoSave({...c,lastCallDate:'',callComment:''});assert.equal(r.status,200);c=(await r.json()).client;assert.equal(c.lastCallDate,'');assert.equal(c.callComment,'');
 console.log('PASS: image deletion, initials retained, date/comment editing and clearing');
 assert.equal((await fetch(origin+'/api/clients')).status,401);
 assert.equal((await fetch(origin+'/api/clients/photo?id='+c.id)).status,401);
 assert.equal((await request('/photo?id='+c.id,{headers:{...identity,'oai-authenticated-user-id':'another-test-user'}})).status,404);
 assert.equal((await request('',{method:'PUT',headers:{...identity,'Content-Type':'application/json','Origin':'https://different.test'},body:JSON.stringify(c)})).status,403);
 const other=await request('',{headers:{...identity,'oai-authenticated-user-id':'another-test-user'}});assert.equal((await other.json()).clients.length,0);
 const forged=await jsonSave({...c,status:0,photoKey:'stolen-image'},'PUT');assert.equal(forged.status,200);assert.equal((await forged.json()).client.photoKey,'');
 assert.equal(statuses.length,7);for(let status=0;status<7;status++)assert.equal(validateClient({...c,status}).status,status);
 console.log('PASS: seven statuses, authentication and owner isolation, server-owned image keys');
 const rows=[{...c,id:'old',company:'Старый',lastCallDate:'2026-08-30'},{...c,id:'new',company:'Новый',lastCallDate:'2026-09-30'},{...c,id:'none',company:'Без даты',lastCallDate:''},{...c,id:'legacy',company:'Архив'}];delete rows[3].lastCallDate;
 const filters={status:-1,potential:'',business:'',search:'',sort:'call-oldest',withoutCall:false};
 assert.deepEqual(selectClients(rows,filters).map(c=>c.id),['old','new','legacy','none']);
 assert.deepEqual(selectClients(rows,{...filters,sort:'call-newest'}).map(c=>c.id),['new','old','legacy','none']);
 assert.deepEqual(selectClients(rows,{...filters,withoutCall:true}).map(c=>c.id),['legacy','none']);
 assert.deepEqual(selectClients(rows,{...filters,status:4,potential:'Высокий',business:'Автопарк',search:'амосов',sort:'call-newest'}).map(c=>c.id),['new','old','legacy','none']);
 assert.equal(selectClients(rows,{...filters,potential:'Низкий'}).length,0);
 assert.equal(formatCallDate('2026-09-30'),'30.09.2026');assert.equal(formatCallDate('2024-02-29'),'29.02.2024');assert.equal(formatCallDate('2026-02-29'),'Без созвона');
 console.log('PASS: both date sorts, null/legacy dates last, combined filters/search, no time-zone shifts');
}finally{for(const id of created){const r=await request('?id='+id,{method:'DELETE'});assert.equal(r.status,200);}}
console.log('All integration checks passed. Test records removed.');
