export const statuses = [
 {name:'Холодный контакт',hint:'Ещё не общались',color:'#738299'},
 {name:'Лид',hint:'Проявил интерес',color:'#6474df'},
 {name:'Горячий',hint:'Есть открытая сделка или выставлен счёт',color:'#ed7740'},
 {name:'Новый',hint:'Одна оплата за последние 6 месяцев',color:'#20a5a0'},
 {name:'Постоянный',hint:'Несколько оплат за последние 6 месяцев',color:'#24815b'},
 {name:'Остывающий',hint:'Появились признаки ухода',color:'#b78b22'},
 {name:'Бывший или потерянный',hint:'Сотрудничество завершено или контакт потерян',color:'#ad6276'},
];
export const fields = [
 ['company','Компания','text','Название компании'],['website','Сайт','url','https://example.ru'],['region','Город / регион','text','Например, Санкт-Петербург'],
 ['business','Тип бизнеса','select','Магазин|Сеть|Сервис|Оптовик|Дистрибьютор|Автопарк'],['oil','Масла в ассортименте','select','Есть|Нет'],['brands','Текущие бренды','text','Shell, Mobil, Лукойл…'],['chemistry','Автохимия','select','Есть|Нет'],['parts','Фильтры / запчасти','select','Есть|Нет'],['locations','Количество точек','number','Если известно'],['audience','Целевая аудитория','select','B2C|B2B|Смешанная'],['potential','Потенциал','select','Высокий|Средний|Низкий'],['interests','Что может быть интересно','multi','Цена|Наличие|Ассортимент|Маржа|Доставка|Собственная марка'],['approach','С чем заходить','textarea','Конкретный аргумент для первого контакта'],['objection','Возможное возражение','textarea','Например: «У нас уже есть поставщик»'],['response','Ответ на возражение','textarea','Рекомендуемая линия разговора'],['decisionMaker','Кому звонить','text','Закупки / собственник / коммерческий директор'],['contacts','Контакты','textarea','Имя, телефон, email или ссылка на форму'],['nextStep','Следующий шаг','select','Звонок|Письмо|КП|Повторный контакт'],
 ['lastCallDate','Дата последнего созвона','date',''],
 ['callComment','Комментарий к созвону','textarea','Результат разговора и договорённости'],
] as const;
export type Client = {id:string;status:number;updatedAt:string;[key:string]:string|number};
export function blankClient(): Client {return {id:'',status:0,company:'',updatedAt:'',initials:'',photoKind:'logo',photoKey:'',...Object.fromEntries(fields.filter(f=>f[0]!=='company').map(f=>[f[0],'']))};}
export function validateClient(input: unknown): Client {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некорректная анкета');
 const v=input as Record<string,unknown>; const c=blankClient();
 if(typeof v.company!=='string'||!v.company.trim()) throw new Error('Укажите компанию');
 if(!Number.isInteger(v.status)||Number(v.status)<0||Number(v.status)>6)throw new Error('Выберите статус');
 c.status=Number(v.status);
 if(v.initials!==undefined&&(typeof v.initials!=='string'||v.initials.length>60))throw new Error('Инициалы / имя ИП: не более 60 символов');
 c.initials=typeof v.initials==='string'?v.initials.trim():'';
 if(v.photoKind!==undefined&&!['logo','person'].includes(String(v.photoKind)))throw new Error('Выберите тип изображения');
 c.photoKind=typeof v.photoKind==='string'?v.photoKind:'logo';
 for(const [key,,type,options] of fields){const value=v[key]??'';if(typeof value!=='string'||value.length>6000)throw new Error('Поле заполнено некорректно: '+key); c[key]=value.trim(); if(type==='select'&&value&&!options.split('|').includes(value))throw new Error('Некорректный выбор: '+key);}
 if(c.website){try{const u=new URL(String(c.website));if(!['http:','https:'].includes(u.protocol))throw 0;}catch{throw new Error('Укажите сайт в формате https://example.ru');}}
 if(c.locations&&!/^\d+$/.test(String(c.locations)))throw new Error('Количество точек должно быть целым неотрицательным числом');
 if(c.interests&&String(c.interests).split(', ').some(x=>!fields.find(f=>f[0]==='interests')![3].split('|').includes(x)))throw new Error('Некорректный выбор интересов');
 if(c.lastCallDate&&!isCallDate(String(c.lastCallDate)))throw new Error('Укажите корректную дату последнего созвона');
 return c;
}

// Calendar dates stay date-only, so another device's time zone cannot shift them.
export function isCallDate(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function formatCallDate(value:unknown):string {
 if(typeof value!=='string'||!isCallDate(value))return 'Без созвона';
 return value.split('-').reverse().join('.');
}
export type ClientFilters={status:number;potential:string;business:string;search:string;sort:string;withoutCall:boolean};
export function selectClients(clients:Client[],filters:ClientFilters):Client[] {
 const {status,potential,business,sort,withoutCall}=filters;
 const query=filters.search.trim().toLocaleLowerCase('ru');
 return clients.filter(c=>(status===-1||c.status===status)
  &&(!potential||c.potential===potential)&&(!business||c.business===business)
  &&(!withoutCall||!c.lastCallDate)
  &&(!query||[c.company,c.region,c.brands,c.contacts,c.website,c.initials].some(v=>String(v||'').toLocaleLowerCase('ru').includes(query))))
 .sort((a,b)=>{
  if(sort==='call-oldest'||sort==='call-newest'){
   const aDate=String(a.lastCallDate||''),bDate=String(b.lastCallDate||'');
   if(!aDate&&bDate)return 1;
   if(aDate&&!bDate)return -1;
   const byDate=sort==='call-oldest'?aDate.localeCompare(bDate):bDate.localeCompare(aDate);
   return byDate||String(a.company).localeCompare(String(b.company),'ru');
  }
  if(sort==='name')return String(a.company).localeCompare(String(b.company),'ru');
  if(sort==='status')return a.status-b.status;
  if(sort==='potential')return ['Высокий','Средний','Низкий',''].indexOf(String(a.potential))-['Высокий','Средний','Низкий',''].indexOf(String(b.potential));
  return b.updatedAt.localeCompare(a.updatedAt);
 });
}
