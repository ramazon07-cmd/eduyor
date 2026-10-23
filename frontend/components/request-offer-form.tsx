'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowUpRight,CalendarCheck} from 'lucide-react';
import {useI18n} from './i18n';
import {Notice} from './common';
import {Button} from './ui/button';
import {dayChipParts,selectedDateLabel} from '@/lib/dates';
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
  const [price,setPrice]=useState(String(own?.price||item.budget));
  const [message,setMessage]=useState(own?.message||'');
  useEffect(()=>{
    let active=true;setSlots(null);setSlotError('');
    api<SlotData>(`mentors/${mentorId}/slots/?timezone=${encodeURIComponent(timeZone)}`).then(result=>{if(active)setSlots(result);}).catch(e=>{if(active)setSlotError(e.message);});
    return()=>{active=false;};
  },[mentorId,timeZone,retry]);
  const days=[...new Set(slots?.slots.map(slot=>slot.date)||[])];
  const selectedSlot=slots?.slots.find(slot=>Date.parse(slot.starts_at)===Date.parse(start));
  const validStart=!!selectedSlot;
  const daySlots=slots?.slots.filter(slot=>slot.date===day)||[];
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!validStart)return;
    setBusy(true);setError('');setSaved(false);
    try{await api<RequestOffer>(`requests/${item.id}/offers/`,{method:'POST',body:JSON.stringify({price,message,starts_at:start})});setSaved(true);onSaved();}
    catch(e){setError((e as Error).message);setRetry(n=>n+1);}
    finally{setBusy(false);}
  }
  return <section className="request-offer-editor"><h2>{t(own?'Taklifingizni yangilang':'Yechimingizni taklif qiling')}</h2><p>{t('Qanday yordam berishingizni yozing va dars vaqtini tanlang.')}</p><form className="form-stack" onSubmit={submit}>
    <label>{t('Taklif narxi (UZS)')}<span className="offer-price"><input type="number" name="price" value={price} onChange={event=>setPrice(event.target.value)} min={30000} max={Number(item.budget)} step={1} required/><span aria-hidden="true">UZS</span></span><small>{t('Budjetdan oshmasin:')} {money(item.budget)}</small></label>
    <label>{t('Taklif izohi')}<textarea name="message" required maxLength={1000} rows={4} value={message} onChange={event=>setMessage(event.target.value)} placeholder={t('Darsda muammoni qanday hal qilasiz?')}/><small className="offer-count" aria-hidden="true">{message.length} / 1000</small></label>
    <fieldset className="offer-picker"><legend>{t('Dars kuni')}</legend>{days.length?<div className="offer-days">{days.map(date=>{const parts=dayChipParts(date,locale);return <label key={date} className="offer-chip offer-day" title={selectedDateLabel(date,locale)}><input type="radio" name="day" value={date} checked={day===date} onChange={()=>{setDay(date);setStart('');}}/><span><small>{parts.weekday}</small><strong>{parts.day}</strong><small>{parts.month}</small></span></label>;})}</div>:<p className="offer-hint">{slots?t('Hozircha bo‘sh vaqt yo‘q'):t('Bo‘sh vaqtlar yuklanmoqda…')}</p>}</fieldset>
    <fieldset className="offer-picker"><legend>{t('Dars vaqti')}</legend>{day?<div className="offer-times">{daySlots.map(slot=><label key={slot.starts_at} className="offer-chip offer-time"><input type="radio" name="time" value={slot.starts_at} checked={Date.parse(slot.starts_at)===Date.parse(start)} onChange={()=>setStart(slot.starts_at)}/><span>{slot.time}</span></label>)}</div>:<p className="offer-hint">{t('Avval sanani tanlang.')}</p>}<small>{timeZone} · {t('Kamida 24 soat oldin, keyingi 30 kun ichida.')}</small></fieldset>
    {slotError&&<Notice kind="error">{t(slotError)}<button type="button" onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>}
    {validStart&&<p className="offer-summary" role="status"><CalendarCheck size={18} aria-hidden="true"/><span>{selectedDateLabel(day,locale)}, {selectedSlot?.time}</span><strong>{money(price)}</strong></p>}
    {error&&<Notice kind="error">{t(error)}</Notice>}{saved&&<Notice kind="success">{t('Taklifingiz yuborildi. O‘quvchi tanlovini shu yerda ko‘rasiz.')}</Notice>}
    <Button disabled={busy||!validStart}>{t(busy?'Saqlanmoqda…':own?'Taklifni yangilash':'Taklif yuborish')}<ArrowUpRight size={17}/></Button><p className="tiny muted">{t('Taklif yuborish vaqtni band qilmaydi. O‘quvchi tanlaganda vaqt qayta tekshiriladi.')}</p>
  </form></section>;
}
