'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck,Users} from 'lucide-react';
import {useI18n} from './i18n';
import {Notice} from './common';
import {Card} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {api} from '@/lib/api';
import type {Family} from '@/lib/family';
import './parent-access.css';

// The child's side of a family link: consent by entering the parent's code, revoke at any time.
export function ParentAccess(){
  const {t}=useI18n();
  const [family,setFamily]=useState<Family|null>(null);const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState(false);
  useEffect(()=>{let active=true;api<Family>('family/').then(data=>{if(active)setFamily(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function join(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess(false);try{setFamily(await api<Family>('family/join/',{method:'POST',body:JSON.stringify({code})}));setCode('');setSuccess(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function unlink(link:number){if(!window.confirm(t('Ulanish uzilsinmi? Bu ota-ona natijalaringizni boshqa ko‘ra olmaydi.')))return;setError('');setSuccess(false);try{await api(`family/links/${link}/`,{method:'DELETE'});setFamily(f=>f&&{...f,parents:f.parents.filter(p=>p.link!==link)});}catch(e){setError((e as Error).message);}}
  return <Card className="form-card parent-access" id="parent-access">
    <h2><Users size={22} aria-hidden="true"/>{t('Ota-ona bilan ulash')}</h2>
    <p>{t('Ota-onangiz bergan kodni kiriting. Ular darslaringiz, vazifalaringiz va natijalaringizni ko‘radi.')}</p>
    {error&&<Notice kind="error">{t(error)}</Notice>}{success&&<Notice kind="success">{t('Ota-onangiz ulandi.')}</Notice>}
    {!!family?.parents.length&&<ul className="parent-list">{family.parents.map(p=><li key={p.link}><span><strong>{p.full_name}</strong><small>{t('Natijalaringizni ko‘radi')}</small></span><Button type="button" variant="ghost" size="sm" onClick={()=>unlink(p.link)}>{t('Uzish')}</Button></li>)}</ul>}
    <form className="parent-code-form" onSubmit={join}><label>{t('Ulash kodi')}<Input value={code} onChange={e=>setCode(e.target.value)} placeholder="ABCD-2345" maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} required/></label><Button disabled={busy}>{t(busy?'Kutilmoqda…':'Ulash')}</Button></form>
    <div className="private-note"><ShieldCheck size={16}/>{t('Kodni faqat ota-onangiz yoki vasiyingiz bersa kiriting. Ulanishni istalgan vaqtda uzishingiz mumkin.')}</div>
  </Card>;
}
