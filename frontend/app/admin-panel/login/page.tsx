'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,CalendarDays,Eye,EyeOff,GraduationCap,LayoutDashboard,Mail} from 'lucide-react';
import {useI18n} from '@/components/i18n';
import {BrandMark} from '@/components/brand';
import {api} from '@/lib/api';
import './login.css';

export default function AdminLogin(){
  const {t}=useI18n();
  const router=useRouter();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError('');
    try{await api('control/login/',{method:'POST',body:JSON.stringify({email:data.get('email'),password:data.get('password')})});router.replace('/admin-panel');}
    catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <main className="control-login">
    <section className="control-login-brand" aria-labelledby="control-welcome-title">
      <div className="control-login-mark"><BrandMark/></div>
      <div className="control-login-brand-copy"><span className="control-eyebrow">EDUYOR / ADMIN</span><h1 id="control-welcome-title">{t('Hammasi bir joyda.')}</h1><p>{t('Mentorlar, darslar va to‘lovlarni boshqaring.')}</p></div>
      <div className="control-login-topics"><span><GraduationCap size={18}/>{t('Mentorlar')}</span><span><CalendarDays size={18}/>{t('Darslar va to‘lovlar')}</span></div>
      <span className="control-login-orbit" aria-hidden="true"/>
    </section>
    <div className="control-login-panel">
      <div className="control-login-heading"><span className="control-login-icon"><LayoutDashboard size={22}/></span><span className="control-eyebrow">{t('BOSHQARUV PANELI')}</span><h2>{t('Admin kirishi')}</h2><p>{t('Alohida administrator hisobingiz bilan kiring.')}</p></div>
      <form onSubmit={submit} className="control-login-form">
        <label htmlFor="admin-email">{t('Email')}</label><div className="control-login-field"><Mail size={18} aria-hidden="true"/><input id="admin-email" name="email" type="email" autoComplete="username" placeholder="admin@eduyor.uz" required maxLength={254} disabled={busy}/></div>
        <label htmlFor="admin-password">{t('Parol')}</label><div className="control-login-field control-login-password"><input id="admin-password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder={t('Parolingizni kiriting')} required maxLength={128} disabled={busy}/><button type="button" className="control-password-toggle" aria-label={t(showPassword?'Parolni yashirish':'Parolni ko‘rsatish')} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
        {error&&<p role="alert" className="control-error">{t(error)}</p>}
        <button className="control-login-submit" disabled={busy} type="submit">{t(busy?'Kirilmoqda…':'Panelga kirish')}<ArrowRight size={18}/></button>
      </form>
      <a href="/" className="control-login-back"><ArrowLeft size={15}/>{t('Saytga qaytish')}</a>
    </div>
  </main>;
}
