'use client';
import {useI18n} from '@/components/i18n';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {useAuth} from './auth';
import {api} from '@/lib/api';
import type {User} from '@/lib/types';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {Notice} from './common';
import {BrandMark} from './brand';
export function AuthForm({register=false}:{register?:boolean}){
  const {t:translate}=useI18n();
  const router=useRouter();const {setUser}=useAuth();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [search,setSearch]=useState('');
  useEffect(()=>setSearch(window.location.search),[]);
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const data=Object.fromEntries(new FormData(e.currentTarget));try{const u=await api<User>(`auth/${register?'register':'login'}/`,{method:'POST',body:JSON.stringify(data)});setUser(u);const next=new URLSearchParams(window.location.search).get('next');router.replace(next?.startsWith('/')&&!next.startsWith('//')&&!next.startsWith('/\\')?next:'/dashboard/home');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="auth-layout container"><div className="auth-aside"><div className="eyebrow">{translate("BIRGA O‘SISH UCHUN")}</div><h1>{translate(register?'Har bir tajriba — bir imkoniyat.':'Qadamingizni davom ettiring.')}</h1><p>{translate("Bugun o‘rganing. Ertaga o‘rgating.")}<br/>{translate("Ikkalasi uchun ham bitta hisob.")}</p><div className="auth-symbol"><BrandMark label="EduYor"/></div></div><div className="auth-panel"><h2>{translate(register?'Hisob yarating':'Xush kelibsiz')}</h2><p className="muted">{translate(register?'O‘rganish sari birinchi qadam.':'Hisobingizga kirib, darslaringizni boshqaring.')}</p>{error&&<Notice kind="error">{translate(error)}</Notice>}<form onSubmit={submit} className="form-stack">{register&&<label>{translate("To‘liq ism")}<Input name="full_name" autoComplete="name" placeholder={translate("Ism Familiya")} maxLength={120} required/></label>}<label>{translate("Email")}<Input name="email" type="email" autoComplete="email" placeholder={translate("siz@example.com")} required/></label><label>{translate("Parol")}<Input name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={register?8:1} maxLength={128} required/>{register&&<small>{translate("Kamida 8 belgi. Oddiy yoki faqat raqamli parol ishlatmang.")}</small>}</label><Button type="submit" disabled={busy}>{translate(busy?'Kutilmoqda…':register?'Hisob yaratish':'Kirish')}<ArrowRight size={17}/></Button></form><p className="small auth-switch">{translate(register?'Hisobingiz bormi?':'Hali hisobingiz yo‘qmi?')} <Link href={`${register?'/login':'/register'}${search}`}>{translate(register?'Kirish':'Ro‘yxatdan o‘tish')}</Link></p><div className="private-note"><ShieldCheck size={16}/>{translate("Email va o‘rganish maqsadingiz hammaga ko‘rinmaydi.")}</div></div></div>;
}
