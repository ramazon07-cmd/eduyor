'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '@/lib/api';
export default function AdminLogin(){
 const router=useRouter();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setError('');try{await api('control/login/',{method:'POST',body:JSON.stringify({email:data.get('email'),password:data.get('password')})});router.replace('/admin-panel');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="control-login"><div className="control-login-brand"><a href="/">EduYor<span>●</span></a><h1>Hammasi bir joyda.</h1><p>Mentorlar, darslar va to‘lovlarni boshqaring.</p></div><form onSubmit={submit} className="control-login-form"><span className="control-eyebrow">BOSHQARUV PANELI</span><h2>Admin kirishi</h2><p>Alohida administrator hisobingiz bilan kiring.</p><label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Parol<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>{error&&<p role="alert" className="control-error">{error}</p>}<button disabled={busy} type="submit">{busy?'Kirilmoqda…':'Panelga kirish →'}</button><a href="/">← Saytga qaytish</a></form></main>;
}
