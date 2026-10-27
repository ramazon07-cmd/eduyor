'use client';
import {useState} from 'react';
import {MailCheck} from 'lucide-react';
import {useI18n} from './i18n';
import {Notice} from './common';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {api} from '@/lib/api';
import type {User} from '@/lib/types';
import './parent-access.css';

// Six-digit code sent at sign-up; booking stays locked until it is entered.
export function EmailVerify({email,onVerified}:{email:string;onVerified:(user:User)=>void}){
  const {t}=useI18n();
  const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [info,setInfo]=useState('');
  async function verify(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setInfo('');try{onVerified(await api<User>('auth/verify-email/',{method:'POST',body:JSON.stringify({code})}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function resend(){setError('');setInfo('');try{setInfo((await api<{detail:string}>('auth/verify-email/resend/',{method:'POST'})).detail);}catch(e){setError((e as Error).message);}}
  return <div className="form-stack">
    <h2><MailCheck size={22} aria-hidden="true"/> {t('Emailingizni tasdiqlang')}</h2>
    <p className="muted">{t('Tasdiqlash kodi yuborildi:')} <strong>{email}</strong></p>
    {error&&<Notice kind="error">{t(error)}</Notice>}{info&&<Notice kind="success">{t(info)}</Notice>}
    <form className="parent-code-form" onSubmit={verify}><label>{t('6 xonali kod')}<Input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} minLength={6} required/></label><Button disabled={busy}>{t(busy?'Kutilmoqda…':'Tasdiqlash')}</Button></form>
    <p className="small">{t('Kod kelmadimi? Spam papkasini tekshiring.')} <button type="button" className="text-link" onClick={resend}>{t('Qayta yuborish')}</button></p>
  </div>;
}
