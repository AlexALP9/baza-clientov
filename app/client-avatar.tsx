'use client';
import {useState} from 'react';
import type {Client} from '@/lib/client-model';
export default function ClientAvatar({client,preview,large=false}:{client:Client;preview?:string;large?:boolean}){
 const src=preview!==undefined?preview:client.photoKey?'/api/clients/photo?id='+encodeURIComponent(client.id)+'&v='+encodeURIComponent(String(client.photoKey)):'';
 const [failedSource,setFailedSource]=useState('');
 const words=String(client.initials||'').match(/[\p{L}\p{N}]+/gu)||[];
 const initials=(words.length>1?words.slice(0,3).map(word=>word[0]).join(''):String(client.initials||client.company||'?').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2)).toLocaleUpperCase('ru')||'?';
 return <span className={'avatar client-avatar '+(large?'avatar-large ':'')+(client.photoKind==='person'?'person-photo':'company-logo')}>
 {/* The authenticated image endpoint and local previews must be loaded directly. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 {src&&failedSource!==src?<img src={src} alt={client.photoKind==='person'?'Фото ИП '+(client.initials||client.company):'Логотип '+client.company} onError={()=>setFailedSource(src)}/>:<span aria-label={String(client.initials||'Инициалы компании')}>{initials}</span>}
 </span>;
}
