import {dateTime} from './dates';
export class ApiError extends Error {
  constructor(public status:number,public fields:Record<string,unknown>) {
    const labels:Record<string,string> = {rating:'Baho',comment:'Izoh',full_name:'Ism',email:'Email',password:'Parol',timezone:'Vaqt zonasi',headline:'Sarlavha',bio:'Bio',subjects:'Yo‘nalishlar',hourly_price:'Narx',min_price:'Eng past narx',max_price:'Eng yuqori narx',language:'Ta’lim tili',ordering:'Saralash',subject:'Yo‘nalish',search:'Qidiruv',objective:'Dars maqsadi',reference:'Tranzaksiya raqami',rules:'Jadval',avatar:'Rasm'};
    const format = (v:unknown):string => Array.isArray(v)?v.map(format).join(' '):v && typeof v==='object'?Object.entries(v).map(([k,x])=>`${labels[k]||k}: ${format(x)}`).join(' '):String(v);
    super(Object.entries(fields).map(([k,v])=>`${k==='detail'||k==='non_field_errors'?'':(labels[k]||k)+': '}${format(v)}`).join(' '));
  }
}
const csrfToken = () => document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.split('=').slice(1).join('=');
export async function api<T>(path:string,init:RequestInit = {}):Promise<T> {
  const method = init.method || 'GET';
  const headers = new Headers(init.headers);
  if (!['GET','HEAD','OPTIONS'].includes(method.toUpperCase())) {
    if (!csrfToken()) {
      const bootstrap = await fetch('/api/auth/csrf/',{credentials:'same-origin',cache:'no-store'});
      if (!bootstrap.ok) throw new Error('Xavfsizlik sozlamasini yuklab bo‘lmadi.');
    }
    headers.set('X-CSRFToken',decodeURIComponent(csrfToken()||''));
    if (!(init.body instanceof FormData)) headers.set('Content-Type','application/json');
  }
  const response = await fetch(`/api/${path}`,{...init,headers,credentials:'same-origin',cache:'no-store'});
  const data = await response.json().catch(()=>({detail:'Server bilan aloqa amalga oshmadi.'}));
  if (!response.ok) throw new ApiError(response.status,data);
  return data as T;
}
export const money = (amount:string|number) => `${new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Number(amount)).replaceAll(',',' ')} UZS`;
export const when = dateTime;
export const statusLabel:Record<string,string> = {pending_payment:'To‘lov kutilmoqda',confirmed:'Tasdiqlangan',completed:'Yakunlangan',cancelled:'Bekor qilingan',expired:'Muddati tugagan',unpaid:'To‘lanmagan',submitted:'Tekshiruvda',verified:'Tekshirilgan',refund_required:'Pul qaytarilishi kerak',refunded:'Pul qaytarilgan',pending:'Kutilmoqda',paid:'To‘langan',not_eligible:'Hali hisoblanmagan'};
