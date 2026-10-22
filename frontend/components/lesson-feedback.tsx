'use client';

import {useEffect,useRef,useState} from 'react';
import {Check,MessageSquare,Star,X} from 'lucide-react';
import {api} from '@/lib/api';
import {FEEDBACK_COMMENT_DELAY_MS,feedbackSecondsRemaining,canDismissFeedback} from '@/lib/feedback';
import type {Booking} from '@/lib/types';
import {useI18n} from './i18n';
import {Avatar,Notice} from './common';
import {Button} from './ui/button';
import './lesson-feedback.css';

export function LessonFeedback({booking,onSaved,onClose}:{booking:Booking;onSaved:(booking:Booking)=>void;onClose:()=>void}){
  const {t}=useI18n();
  const dialog=useRef<HTMLDialogElement>(null);
  const [phase,setPhase]=useState<'rating'|'comment'>(()=>booking.feedback_rating?'comment':'rating');
  const [rating,setRating]=useState(booking.feedback_rating||0);
  const [comment,setComment]=useState(booking.feedback_comment||'');
  const [deadline,setDeadline]=useState<number|null>(()=>booking.feedback_rating?Date.now()+FEEDBACK_COMMENT_DELAY_MS:null);
  const [now,setNow]=useState(Date.now);
  const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const [error,setError]=useState('');
  const remaining=feedbackSecondsRemaining(deadline,now);
  const canClose=phase==='comment'&&canDismissFeedback(rating,deadline,now);

  useEffect(()=>{const element=dialog.current;if(!element)return;element.showModal();return()=>element.close();},[]);
  useEffect(()=>{
    if(phase!=='comment'||deadline===null)return;
    const timer=setInterval(()=>{const current=Date.now();setNow(current);if(current>=deadline)clearInterval(timer);},200);
    return()=>clearInterval(timer);
  },[phase,deadline]);

  async function saveRating(){
    if(!rating){setError('1 dan 5 gacha yulduz tanlang.');return;}
    if(saving.current)return;
    saving.current=true;setBusy(true);setError('');
    try{
      const updated=await api<Booking>(`bookings/${booking.id}/feedback/`,{method:'POST',body:JSON.stringify({rating})});
      // Persist the mandatory rating before the optional comment stage can close.
      onSaved(updated);setNow(Date.now());setDeadline(Date.now()+FEEDBACK_COMMENT_DELAY_MS);setPhase('comment');
    }catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}
  }
  async function finish(){
    if(saving.current)return;
    saving.current=true;setBusy(true);setError('');
    try{
      if(comment.trim()!==(booking.feedback_comment||'').trim()){
        const updated=await api<Booking>(`bookings/${booking.id}/feedback/`,{method:'POST',body:JSON.stringify({rating,comment:comment.trim()})});
        onSaved(updated);
      }
      onClose();
    }catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}
  }

  return <dialog ref={dialog} className="lesson-feedback-dialog" aria-labelledby="lesson-feedback-title" aria-describedby="lesson-feedback-description" onCancel={event=>{event.preventDefault();if(canClose&&!busy)void finish();}}>
    <div className="lesson-feedback-header"><span className="lesson-feedback-kicker"><Check size={15}/>{t('Dars yakunlandi')}</span>{canClose&&<button type="button" className="lesson-feedback-close" aria-label={t('Izohni saqlab yopish')} disabled={busy} onClick={()=>void finish()}><X size={20}/></button>}</div>
    <div className="lesson-feedback-person"><Avatar name={booking.mentor_name}/><span>{booking.mentor_name}</span></div>
    <h2 id="lesson-feedback-title">{t(phase==='rating'?'Mentoringizni baholang':'Fikringizni ulashing')}</h2>
    <p id="lesson-feedback-description">{t(phase==='rating'?'Dars qanday o‘tdi? Davom etish uchun yulduzli baho tanlang.':'Yulduzli bahongiz saqlandi. Istasangiz, mentoringiz haqida izoh qoldiring.')}</p>
    {error&&<Notice kind="error">{t(error)}</Notice>}
    {phase==='rating'?<form onSubmit={event=>{event.preventDefault();void saveRating();}}>
      <fieldset className="lesson-feedback-stars" disabled={busy}><legend className="sr-only">{t('Yulduzli baho — majburiy')}</legend>{[1,2,3,4,5].map(value=><label key={value} className={`lesson-feedback-star ${value<=rating?'selected':''}`}><input type="radio" name={`lesson-rating-${booking.id}`} value={value} checked={rating===value} onChange={()=>{setRating(value);setError('');}} required/><Star size={36} strokeWidth={1.5} fill={value<=rating?'currentColor':'none'} aria-hidden="true"/><span className="sr-only">{t(`${value} yulduz`)}</span></label>)}</fieldset>
      <span className="lesson-feedback-rating-value" aria-live="polite">{rating?`${rating} / 5`:t('Baholash majburiy')}</span>
      <Button type="submit" disabled={busy||!rating}>{t(busy?'Saqlanmoqda…':'Bahoni saqlash va davom etish')}<Star size={16}/></Button>
    </form>:<form onSubmit={event=>{event.preventDefault();void finish();}}>
      <div className="lesson-feedback-saved"><Star size={17} fill="currentColor"/>{rating} / 5 <span>{t('Baho saqlandi')}</span></div>
      <label className="lesson-feedback-comment">{t('Izoh — ixtiyoriy')}<textarea autoFocus value={comment} onChange={event=>setComment(event.target.value)} maxLength={1500} rows={4} placeholder={t('Nima foydali bo‘ldi? Mentor nimani yaxshilashi mumkin?')} disabled={busy}/></label>
      <div className="lesson-feedback-countdown" role="status">{remaining>0?<><ClockLabel/>{t(`Yopish tugmasi ${remaining} soniyadan keyin chiqadi.`)}</>:t('Izoh ixtiyoriy. Yozishni davom ettiring yoki X orqali yoping.')}</div>
      <Button type="submit" disabled={busy||!comment.trim()}>{t(busy?'Saqlanmoqda…':'Izohni yuborish')}<MessageSquare size={16}/></Button>
    </form>}
  </dialog>;
}
function ClockLabel(){return <span className="lesson-feedback-timer-dot" aria-hidden="true"/>;}
