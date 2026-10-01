import {getDb} from '@/db';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getPhotos} from '@/lib/client-photos';
export const dynamic='force-dynamic';
const fail=(message:string,status:number)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const user=await getChatGPTUser(req);if(!user)return fail('Войдите в приложение',401);
 const id=new URL(req.url).searchParams.get('id');if(!id)return fail('Не указана карточка',400);
 try{const row=await getDb().prepare('SELECT payload FROM clients WHERE id = ? AND owner = ?').bind(id,user.userId).first<{payload:string}>();const key=row?JSON.parse(row.payload).photoKey:null;if(!key)return fail('Изображение не найдено',404);const photo=await getPhotos().get(key);if(!photo)return fail('Изображение не найдено',404);return new Response(photo.body,{headers:{'Content-Type':photo.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Disposition':'inline'}});}catch(e){console.error(e);return fail('Не удалось загрузить изображение',503);}
}
