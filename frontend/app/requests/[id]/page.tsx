'use client';
import Link from 'next/link';
import {useParams,useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,CalendarDays,MessageSquare,RefreshCw,Check} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {useI18n} from '@/components/i18n';
import {Avatar,Loading,LoginRequired,Notice} from '@/components/common';
import {RequestFacts,RequestStatus} from '@/components/request-summary';
import {RequestOfferForm} from '@/components/request-offer-form';
import {Button} from '@/components/ui/button';
import {api,money,when} from '@/lib/api';
import type {LearningRequest,Booking} from '@/lib/types';

export default function RequestDetail(){
  const {id}=useParams<{id:string}>();
  const router=useRouter();
  const {user,loading}=useAuth();
  const {t,locale}=useI18n();
  const [item,setItem]=useState<LearningRequest|null>(null);
  const [loadedFor,setLoadedFor]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState('');
  const [retry,setRetry]=useState(0);
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<number|null>(null);
  const [closing,setClosing]=useState(false);
  useEffect(()=>{
    if(!user)return;
    let active=true;setError('');
    api<LearningRequest>(`requests/${id}/`).then(row=>{if(active){setItem(row);setLoadedFor(user.id);}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[id,user?.id,retry]);
  async function accept(offerId:number){
    setBusy(true);setActionError('');
    try{const booking=await api<Booking>(`requests/${id}/offers/${offerId}/accept/`,{method:'POST',body:'{}'});router.push(`/sessions/${booking.id}`);}
    catch(e){setActionError((e as Error).message);setBusy(false);setSelected(null);setRetry(n=>n+1);}
  }
  async function close(){
    setBusy(true);setActionError('');
    try{await api(`requests/${id}/close/`,{method:'POST',body:'{}'});setClosing(false);setRetry(n=>n+1);}
    catch(e){setActionError((e as Error).message);}
    finally{setBusy(false);}
  }
  if(loading)return <Loading/>;
  if(!user)return <LoginRequired next={`/requests/${id}`}/>;
  if(error)return <Notice kind="error">{t(error)}<button onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button><Link href="/requests">{t('So‘rovlarga qaytish')}</Link></Notice>;
  if(!item||item.id!==Number(id)||loadedFor!==user.id)return <Loading/>;
  const tz=user.profile.timezone;
  const canOffer=!item.is_owner&&item.status==='open'&&user.mentor?.approval==='approved'&&!user.mentor.is_paused&&user.mentor.subjects.includes(item.subject.id);
  const accepted=item.offers.find(offer=>offer.booking);
  return <div className="request-page">
    <div className="request-detail-nav"><Link href="/requests" className="back-link"><ArrowLeft size={16}/>{t('So‘rovlarga qaytish')}</Link><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setRetry(n=>n+1)}><RefreshCw size={15}/>{t('Yangilash')}</Button></div>
    {actionError&&<Notice kind="error">{t(actionError)}</Notice>}
    <div className={`request-detail-grid ${canOffer?'has-editor':''}`}><div><article className="request-detail-main"><div className="request-item-top"><span className="request-subject">{t(item.subject.name)}</span><RequestStatus status={item.status}/></div><h1>{item.title}</h1><p className="request-description">{item.description}</p><RequestFacts item={item}/><div className="request-author"><span>{item.student_name}</span><span>{when(item.created_at,tz,locale)}</span></div>{accepted&&<div className="request-matched"><Check size={20}/><div><strong>{t('Tanlangan taklif')}</strong><p>{t('Bron 60 daqiqa saqlanadi. Joriy to‘lov va dars holatini tafsilotlardan tekshiring.')}</p><Link className="text-link" href={`/sessions/${accepted.booking}`}>{t('Darsni ochish')} <ArrowUpRight size={16}/></Link></div></div>}{item.status==='matched'&&!accepted&&<p className="muted">{t('O‘quvchi boshqa taklifni tanladi.')}</p>}{item.is_owner&&item.status==='open'&&<div className="request-close">{closing?<><p>{t('So‘rovni yopsangiz, yangi takliflar qabul qilinmaydi.')}</p><Button variant="destructive" size="sm" onClick={close} disabled={busy}>{t('Yopishni tasdiqlash')}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={()=>setClosing(false)}>{t('Bekor qilish')}</Button></>:<button onClick={()=>setClosing(true)} disabled={busy}>{t('So‘rovni yopish')}</button>}</div>}</article>
      <section className="request-offers"><header><div><MessageSquare size={20}/><h2>{t(item.is_owner?'Mentorlardan takliflar':'Sizning taklifingiz')}</h2></div><span>{item.offer_count}</span></header>{item.offers.length?item.offers.map(offer=><article key={offer.id} className={`request-offer ${offer.booking?'is-chosen':''}`}><div className="request-offer-heading"><Link href={`/mentors/${offer.mentor.id}`} className="request-offer-person"><Avatar name={offer.mentor.full_name} src={offer.mentor.avatar} small/><span><strong>{offer.mentor.full_name}</strong><small>{offer.mentor.headline}</small></span></Link><strong className="request-offer-price">{money(offer.price)}</strong></div><p className="request-description">{offer.message}</p><p className="request-offer-time"><CalendarDays size={16}/>{when(offer.starts_at,tz,locale)} · {tz}</p><div className="request-offer-actions"><Link href={`/mentors/${offer.mentor.id}`} className="text-link">{t('Profilni ko‘rish')}<ArrowUpRight size={15}/></Link>{offer.booking?<Link className="btn btn-primary btn-sm" href={`/sessions/${offer.booking}`}><Check size={15}/>{t('Darsni ochish')}</Link>:item.is_owner&&item.status==='open'&&(new Date(offer.starts_at).getTime()<=Date.now()+24*60*60*1000?<span className="muted small">{t('Taklif vaqti eskirgan. Mentor yangilashi kerak.')}</span>:<Button size="sm" disabled={busy} onClick={()=>{setSelected(offer.id);setActionError('');}}>{t('Shu mentorni tanlash')}</Button>)}</div>{selected===offer.id&&item.status==='open'&&<div className="request-accept-review" role="region" aria-label={t('Taklifni tasdiqlash')}><strong>{t('Kelishilgan narx:')} {money(offer.price)}</strong><p>{t('Tanlasangiz, shu vaqtga 60 daqiqalik bron ochiladi. Keyingi sahifada to‘lovni amalga oshirasiz.')}</p><div><Button disabled={busy} onClick={()=>accept(offer.id)}>{t(busy?'Band qilinmoqda…':'Tasdiqlash va bron qilish')}</Button><Button variant="ghost" disabled={busy} onClick={()=>setSelected(null)}>{t('Bekor qilish')}</Button></div></div>}</article>):<div className="request-offers-empty"><MessageSquare size={28}/><h3>{t(item.status!=='open'?'So‘rov yakunlangan':item.is_owner?'Hozircha taklif kelmagan':'O‘z taklifingizni yuboring')}</h3><p>{t(item.status!=='open'?'Bu so‘rov yangi takliflarni qabul qilmaydi.':item.is_owner?'Mentorlar so‘rovingizni ko‘rib, narx va dars vaqtini taklif qiladi.':'Boshqa mentorlarning takliflari faqat so‘rov egasiga ko‘rinadi.')}</p></div>}</section>
    </div>{canOffer?<aside><RequestOfferForm key={item.id} item={item} mentorId={user.id} timeZone={tz} onSaved={()=>setRetry(n=>n+1)}/></aside>:!item.is_owner&&item.status==='open'?<aside className="request-mentor-note"><span className="eyebrow">{t('BILIMINGIZNI ULASHING')}</span><h2>{t('Shu yo‘nalishda yordam bera olasizmi?')}</h2><p>{t('Taklif yuborish uchun shu yo‘nalishdagi mentor profilingiz tasdiqlangan va faol bo‘lishi kerak.')}</p><Link className="text-link" href="/dashboard?tab=mentor">{t('Mentor profilim')}<ArrowUpRight size={16}/></Link></aside>:null}</div>
  </div>;
}
