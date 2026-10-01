import {getDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {validateClient,type Client} from '@/lib/client-model';
import {readClientRequest,validatePhoto,getPhotos,discardPhoto,InputError} from '@/lib/client-photos';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'Войдите в приложение через ChatGPT'},401);
 try{const r=await getDb().prepare('SELECT payload FROM clients WHERE owner = ? ORDER BY updated_at DESC').bind(user.userId).all<{payload:string}>();return json({clients:r.results.map(x=>JSON.parse(x.payload))});}catch(e){console.error(e);return json({error:'Не удалось загрузить клиентов. Попробуйте ещё раз.'},503);}
}
export async function POST(req:Request){return save(req,false);}
export async function PUT(req:Request){return save(req,true);}
async function save(req:Request,update:boolean){
 const user=await getChatGPTUser();if(!user)return json({error:'Войдите в приложение через ChatGPT'},401);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Недопустимый запрос'},403);
 let input:Awaited<ReturnType<typeof readClientRequest>>;let c:Client;let photoData:Awaited<ReturnType<typeof validatePhoto>>|null=null;
 try{input=await readClientRequest(req);c=validateClient(input.raw);if(update&&(typeof input.raw.id!=='string'||!input.raw.id))throw new InputError('Не найдена карточка');if(input.photo)photoData=await validatePhoto(input.photo);}catch(e){return json({error:e instanceof Error?e.message:'Некорректная анкета'},e instanceof InputError?e.status:400);}
 c.id=update?String(input.raw.id):crypto.randomUUID();c.updatedAt=new Date().toISOString();let oldPhoto='';let newPhoto='';
 try{
  if(update){const row=await getDb().prepare('SELECT payload FROM clients WHERE id = ? AND owner = ?').bind(c.id,user.userId).first<{payload:string}>();if(!row)return json({error:'Карточка не найдена'},404);const previous=JSON.parse(row.payload) as Client;oldPhoto=String(previous.photoKey||'');}
  // Only the server chooses image keys, retaining the owned record's image by default.
  c.photoKey=input.removePhoto?'':oldPhoto;
  if(photoData){newPhoto='client-photos/'+crypto.randomUUID();await getPhotos().put(newPhoto,photoData.bytes,{httpMetadata:{contentType:photoData.type}});c.photoKey=newPhoto;}
  if(update){const r=await getDb().prepare('UPDATE clients SET payload = ?, status = ?, updated_at = ? WHERE id = ? AND owner = ?').bind(JSON.stringify(c),c.status,c.updatedAt,c.id,user.userId).run();if(!r.meta.changes){await discardPhoto(newPhoto);return json({error:'Карточка не найдена'},404);}}
  else{await getDb().prepare('INSERT INTO clients (id,owner,payload,status,updated_at) VALUES (?,?,?,?,?)').bind(c.id,user.userId,JSON.stringify(c),c.status,c.updatedAt).run();}
  if(oldPhoto&&oldPhoto!==c.photoKey)await discardPhoto(oldPhoto);
  return json({client:c},update?200:201);
 }catch(e){await discardPhoto(newPhoto);console.error(e);return json({error:'Не удалось сохранить. Фото и введённые данные остались в форме.'},503);}
}
export async function DELETE(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Войдите в приложение'},401);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Недопустимый запрос'},403);
 const id=new URL(req.url).searchParams.get('id');if(!id)return json({error:'Не указана карточка'},400);
 try{const row=await getDb().prepare('SELECT payload FROM clients WHERE id = ? AND owner = ?').bind(id,user.userId).first<{payload:string}>();if(!row)return json({error:'Карточка не найдена'},404);const r=await getDb().prepare('DELETE FROM clients WHERE id = ? AND owner = ?').bind(id,user.userId).run();if(!r.meta.changes)return json({error:'Карточка не найдена'},404);await discardPhoto(JSON.parse(row.payload).photoKey);return json({ok:true});}catch(e){console.error(e);return json({error:'Не удалось удалить карточку'},503);}
}
