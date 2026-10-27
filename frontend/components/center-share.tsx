'use client';
import {useState} from 'react';
import {useI18n} from './i18n';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {api} from '@/lib/api';
import type {MyCenter,CenterMember} from '@/lib/centers';

// Owner proposes a 0-40% share per mentor; it applies to new lessons once the mentor accepts.
export function CenterShare({member,owner,self,onChange,onError}:{member:CenterMember;owner:boolean;self:boolean;onChange:(data:MyCenter)=>void;onError:(message:string)=>void}){
  const {t}=useI18n();
  const [percent,setPercent]=useState(String(member.share_offer??member.share));const [busy,setBusy]=useState(false);
  async function send(path:string,body?:object){setBusy(true);onError('');try{onChange(await api<MyCenter>(path,{method:'POST',body:body&&JSON.stringify(body)}));}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
  if(member.is_owner)return null;
  return <div className="center-share">
    <small>{t('Markaz ulushi:')} <strong>{member.share}%</strong>{member.share_offer!==null&&<> · {t('taklif')} <strong>{member.share_offer}%</strong></>}</small>
    {owner&&<form onSubmit={e=>{e.preventDefault();void send(`centers/members/${member.id}/share/`,{percent:Number(percent)});}}><Input type="number" min={0} max={40} step={1} value={percent} onChange={e=>setPercent(e.target.value)} aria-label={t('Markaz ulushi, foiz')} required/><Button size="sm" variant="outline" disabled={busy}>{t('Taklif qilish')}</Button></form>}
    {self&&member.share_offer!==null&&<div><Button size="sm" disabled={busy} onClick={()=>send('centers/share/accept/')}>{t('Qabul qilish')}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>send('centers/share/reject/')}>{t('Rad etish')}</Button></div>}
  </div>;
}
