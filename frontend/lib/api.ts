import {dateTime} from './dates';
export class ApiError extends Error {
  constructor(public status:number,public fields:Record<string,unknown>) {
    const labels:Record<string,string> = {instructions:'Ko‘rsatmalar',kind:'Topshiriq turi',deadline:'Topshirish muddati',student:'Student',questions:'Savollar',answer:'Javob',answers:'Javoblar',feedback:'Mentor izohi',expected_reviewed_at:'Izoh versiyasi',title:'Sarlavha',description:'Muammo va maqsad',budget:'Budjet',price:'Narx',message:'Taklif izohi',starts_at:'Dars vaqti',scope:'So‘rovlar',rating:'Baho',comment:'Izoh',full_name:'Ism',email:'Email',password:'Parol',timezone:'Vaqt zonasi',headline:'Sarlavha',bio:'Bio',subjects:'Yo‘nalishlar',hourly_price:'Narx',min_price:'Eng past narx',max_price:'Eng yuqori narx',language:'Ta’lim tili',ordering:'Saralash',subject:'Yo‘nalish',search:'Qidiruv',objective:'Dars maqsadi',reference:'Tranzaksiya raqami',rules:'Jadval',avatar:'Rasm'};
    const format = (v:unknown):string => Array.isArray(v)?v.map(format).join(' '):v && typeof v==='object'?Object.entries(v).map(([k,x])=>`${labels[k]||k}: ${format(x)}`).join(' '):String(v);
    super(Object.entries(fields).map(([k,v])=>`${k==='detail'||k==='non_field_errors'?'':(labels[k]||k)+': '}${format(v)}`).join(' '));
  }
}
async function csrfToken():Promise<string> {
  const response=await fetch('/api/auth/csrf/',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Xavfsizlik sozlamasini yuklab bo‘lmadi.');
  const data=await response.json();
  if(typeof data.csrfToken!=='string'||!data.csrfToken)throw new Error('Xavfsizlik sozlamasini yuklab bo‘lmadi.');
  return data.csrfToken;
}
export async function api<T>(path:string,init:RequestInit = {}):Promise<T> {
  const method=(init.method||'GET').toUpperCase();
  const headers=new Headers(init.headers);
  const writes=!['GET','HEAD','OPTIONS'].includes(method);
  if(writes){
    headers.set('X-CSRFToken',await csrfToken());
    if(!(init.body instanceof FormData))headers.set('Content-Type','application/json');
  }
  for(let attempt=0;attempt<2;attempt++){
    const response=await fetch(`/api/${path}`,{...init,headers,credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>({detail:'Server bilan aloqa amalga oshmadi.'}));
    // A CSRF rejection happens before the view runs, so retrying it cannot duplicate a mutation.
    if(writes&&attempt===0&&response.status===403&&data.code==='csrf_failed'){
      headers.set('X-CSRFToken',await csrfToken());continue;
    }
    if(!response.ok)throw new ApiError(response.status,data);
    return data as T;
  }
  throw new Error('Xavfsizlik sozlamasini yuklab bo‘lmadi.');
}
export const money = (amount:string|number) => `${new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Number(amount)).replaceAll(',',' ')} UZS`;
export const when = dateTime;
export const statusLabel:Record<string,string> = {pending_payment:'To‘lov kutilmoqda',confirmed:'Tasdiqlangan',completed:'Yakunlangan',cancelled:'Bekor qilingan',expired:'Muddati tugagan',unpaid:'To‘lanmagan',submitted:'Tekshiruvda',verified:'Tekshirilgan',refund_required:'Pul qaytarilishi kerak',refunded:'Pul qaytarilgan',pending:'Kutilmoqda',paid:'To‘langan',not_eligible:'Hali hisoblanmagan'};
