'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {useAuth} from './auth';
import {api} from '@/lib/api';
import type {User} from '@/lib/types';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {Notice} from './common';
import {BrandMark} from './brand';
export function AuthForm({register=false}:{register?:boolean}){
  const router=useRouter();const {setUser}=useAuth();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const data=Object.fromEntries(new FormData(e.currentTarget));try{const u=await api<User>(`auth/${register?'register':'login'}/`,{method:'POST',body:JSON.stringify(data)});setUser(u);const next=new URLSearchParams(window.location.search).get('next');router.replace(register?'/dashboard/home':next?.startsWith('/')&&!next.startsWith('//')?next:'/dashboard/home');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="auth-layout container"><div className="auth-aside"><div className="eyebrow">BIRGA O‘SISH UCHUN</div><h1>{register?'Har bir tajriba — bir imkoniyat.':'Qadamingizni davom ettiring.'}</h1><p>Bugun o‘rganing. Ertaga o‘rgating.<br/>Ikkalasi uchun ham bitta hisob.</p><div className="auth-symbol"><BrandMark label="EduYor"/></div></div><div className="auth-panel"><h2>{register?'Hisob yarating':'Xush kelibsiz'}</h2><p className="muted">{register?'O‘rganish sari birinchi qadam.':'Hisobingizga kirib, darslaringizni boshqaring.'}</p>{error&&<Notice kind="error">{error}</Notice>}<form onSubmit={submit} className="form-stack">{register&&<label>To‘liq ism<Input name="full_name" autoComplete="name" placeholder="Ism Familiya" maxLength={120} required/></label>}<label>Email<Input name="email" type="email" autoComplete="email" placeholder="siz@example.com" required/></label><label>Parol<Input name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={register?8:1} maxLength={128} required/>{register&&<small>Kamida 8 belgi. Oddiy yoki faqat raqamli parol ishlatmang.</small>}</label><Button type="submit" disabled={busy}>{busy?'Kutilmoqda…':register?'Hisob yaratish':'Kirish'}<ArrowRight size={17}/></Button></form><p className="small auth-switch">{register?'Hisobingiz bormi?':'Hali hisobingiz yo‘qmi?'} <Link href={register?'/login':'/register'}>{register?'Kirish':'Ro‘yxatdan o‘tish'}</Link></p><div className="private-note"><ShieldCheck size={16}/>Email va o‘rganish maqsadingiz hammaga ko‘rinmaydi.</div></div></div>;
}
