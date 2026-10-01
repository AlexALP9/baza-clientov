import {env} from 'cloudflare:workers';
export const MAX_PHOTO_BYTES=5*1024*1024;
const MAX_REQUEST_BYTES=MAX_PHOTO_BYTES+256*1024;
export class InputError extends Error{constructor(message:string,public status=400){super(message);}}
export function getPhotos(){if(!env.BUCKET)throw new Error('Photo storage unavailable');return env.BUCKET;}
// Bound the actual stream, including requests without Content-Length.
export async function readClientRequest(req:Request){
 if(Number(req.headers.get('content-length'))>MAX_REQUEST_BYTES)throw new InputError('Изображение слишком большое. Максимум — 5 МБ.',413);
 const reader=req.body?.getReader();if(!reader)throw new InputError('Не передана анкета');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_REQUEST_BYTES){await reader.cancel();throw new InputError('Изображение слишком большое. Максимум — 5 МБ.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const body=new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')||''}});
 if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
  const form=await body.formData();const data=form.get('client');if(typeof data!=='string')throw new InputError('Не передана анкета');
  const photo=form.get('photo');if(photo!==null&&(typeof photo==='string'||!photo.size))throw new InputError('Выберите файл изображения');
  return {raw:JSON.parse(data) as Record<string,unknown>,photo:photo as File|null,removePhoto:form.get('removePhoto')==='true'};
 }
 return {raw:await body.json() as Record<string,unknown>,photo:null,removePhoto:false};
}
export async function validatePhoto(photo:File){
 if(photo.size>MAX_PHOTO_BYTES)throw new InputError('Изображение слишком большое. Максимум — 5 МБ.',413);
 const bytes=new Uint8Array(await photo.arrayBuffer());
 const png=bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 const jpg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.length>=16&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 const type=png?'image/png':jpg?'image/jpeg':webp?'image/webp':null;
 if(!type||(photo.type&&photo.type!==type))throw new InputError('Поддерживаются изображения JPG, PNG и WebP.');
 return {bytes,type};
}
export async function discardPhoto(key:unknown){if(!key||typeof key!=='string')return;try{await getPhotos().delete(key);}catch(e){console.error('Photo cleanup failed',e);}}
