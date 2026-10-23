'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {useI18n} from './i18n';
import {Notice} from './common';
import {Button} from './ui/button';
import {selectedDateLabel} from '@/lib/dates';
import {api,money} from '@/lib/api';
import type {LearningRequest,RequestOffer,SlotData} from '@/lib/types';
export function RequestOfferForm({item,mentorId,timeZone,onSaved}:{item:LearningRequest;mentorId:number;timeZone:string;onSaved:()=>void}){
  const {t,locale}=useI18n();
  const own=item.offers.find(offer=>offer.mentor.id===mentorId);
  const [slots,setSlots]=useState<SlotData|null>(null);
  const [slotError,setSlotError]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(0);
  const [saved,setSaved]=useState(false);
  const [day,setDay]=useState(own?new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(own.starts_at)):'');
  const [start,setStart]=useState(own?.starts_at||'');
  useEffect(()=>{
    let active=true;setSlots(null);setSlotError('');
    api<SlotData>(`mentors/${mentorId}/slots/?timezone=${encodeURIComponent(timeZone)}`).then(result=>{if(active)setSlots(result);}).catch(e=>{if(active)setSlotError(e.message);});
    return()=>{active=false;};
  },[mentorId,timeZone,retry]);
  const days=[...new Set(slots?.slots.map(slot=>slot.date)||[])];
  const selectedSlot=slots?.slots.find(slot=>Date.parse(slot.starts_at)===Date.parse(start));
  const validStart=!!selectedSlot;
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!validStart)return;
    setBusy(true);setError('');setSaved(false);
    const values=Object.fromEntries(new FormData(event.currentTarget));
    try{await api<RequestOffer>(`requests/${item.id}/offers/`,{method:'POST',body:JSON.stringify({...values,starts_at:start})});setSaved(true);onSaved();}
    catch(e){setError((e as Error).message);setRetry(n=>n+1);}
    finally{setBusy(false);}
  }
  return <section className="request-offer-editor"><span className="eyebrow">{t('MENTOR UCHUN')}</span><h2>{t(own?'Taklifingizni yangilang':'Yechimingizni taklif qiling')}</h2><p>{t('Qanday yordam berishingizni yozing va dars vaqtini tanlang.')}</p><form className="form-stack" onSubmit={submit}><label>{t('Taklif narxi (UZS)')}<input type="number" name="price" defaultValue={own?.price||item.budget} min={30000} max={Number(item.budget)} step={1} required/><small>{t('Budjetdan oshmasin:')} {money(item.budget)}</small></label><label>{t('Taklif izohi')}<textarea name="message" required maxLength={1000} rows={4} defaultValue={own?.message||''} placeholder={t('Darsda muammoni qanday hal qilasiz?')}/></label><label>{t('Dars kuni')}<select value={day} onChange={event=>{setDay(event.target.value);setStart('');}} required><option value="">{t('Sanani tanlang')}</option>{days.map(date=><option key={date} value={date}>{selectedDateLabel(date,locale)}</option>)}</select></label><label>{t('Dars vaqti')}<select value={selectedSlot?.starts_at||''} onChange={event=>setStart(event.target.value)} required disabled={!day||!slots}><option value="">{t('Vaqtni tanlang')}</option>{slots?.slots.filter(slot=>slot.date===day).map(slot=><option key={slot.starts_at} value={slot.starts_at}>{slot.time}</option>)}</select><small>{timeZone} · {t('Kamida 24 soat oldin, keyingi 30 kun ichida.')}</small></label>{!slots&&!slotError&&<p role="status">{t('Bo‘sh vaqtlar yuklanmoqda…')}</p>}{slots&&!slots.slots.length&&<p>{t('Hozircha bo‘sh vaqt yo‘q')}</p>}{slotError&&<Notice kind="error">{t(slotError)}<button type="button" onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>}{error&&<Notice kind="error">{t(error)}</Notice>}{saved&&<Notice kind="success">{t('Taklifingiz yuborildi. O‘quvchi tanlovini shu yerda ko‘rasiz.')}</Notice>}<Button disabled={busy||!validStart}>{t(busy?'Saqlanmoqda…':own?'Taklifni yangilash':'Taklif yuborish')}<ArrowUpRight size={17}/></Button><p className="tiny muted">{t('Taklif yuborish vaqtni band qilmaydi. O‘quvchi tanlaganda vaqt qayta tekshiriladi.')}</p></form></section>;
}
