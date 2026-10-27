'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowDown,ArrowUpRight,Building2,Check,Globe,KeyRound,MapPin,Users} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {useI18n} from '@/components/i18n';
import {Empty,Loading,MentorCard,Notice} from '@/components/common';
import {CenterLogo} from '@/components/center-logo';
import {InviteCode} from '@/components/invite-code';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/api';
import {centerInitials,type Center,type MyCenter} from '@/lib/centers';
import type {Mentor,Page} from '@/lib/types';
import '../centers.css';
import './profile.css';

export default function CenterPage(){
  const {id}=useParams<{id:string}>();
  return <CenterProfile key={id} id={id}/>;
}

function CenterProfile({id}:{id:string}){
  const {t}=useI18n();
  const [center,setCenter]=useState<Center|null>(null);
  const [mentors,setMentors]=useState<Mentor[]|null>(null);
  const [next,setNext]=useState<string|null>(null);
  const [page,setPage]=useState(1);
  const [error,setError]=useState('');
  const [mentorError,setMentorError]=useState('');
  const [retry,setRetry]=useState(0);
  const [moreBusy,setMoreBusy]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setError('');
    api<Center>(`centers/${id}/`,{signal:controller.signal}).then(setCenter).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[id,retry]);
  useEffect(()=>{
    const controller=new AbortController();
    setMentorError('');setMoreBusy(true);
    api<Page<Mentor>>(`mentors/?center=${id}&page=${page}`,{signal:controller.signal}).then(result=>{
      setMentors(rows=>page===1?result.results:[...(rows||[]),...result.results]);setNext(result.next);
    }).catch(e=>{if(!controller.signal.aborted)setMentorError(e.message);}).finally(()=>{if(!controller.signal.aborted)setMoreBusy(false);});
    return()=>controller.abort();
  },[id,page,retry]);
  const back=<Link href="/centers" className="back-link"><ArrowLeft size={16} aria-hidden/>{t('Markazlarga qaytish')}</Link>;
  if(!center)return <div className="dashboard-page centers-page center-profile">{back}{error?<Notice kind="error">{t(error)}<Button variant="ghost" onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</Button></Notice>:<div className="cp-skeleton" role="status"><span className="sr-only">{t('Yuklanmoqda…')}</span><div/><div/><div/></div>}</div>;
  const offline=center.kind==='offline';
  return <div className="dashboard-page centers-page center-profile">
    <div className="cp-breadcrumb">{back}<span><Building2 size={14} aria-hidden/>{t('O‘quv markazi')}</span></div>
    <header className="cp-masthead">
      <div className="cp-identity">
        <CenterLogo className="cp-brand" name={center.name} logo={center.logo}><Building2 size={20}/><strong>{centerInitials(center.name)}</strong><span>EDUYOR</span></CenterLogo>
        <div className="cp-title"><span className="cp-eyebrow">{t('O‘quv markazi')}</span><h1>{center.name}</h1><div className="cp-title-meta"><span className={`center-kind ${center.kind}`}>{offline?<MapPin size={14} aria-hidden/>:<Globe size={14} aria-hidden/>}{t(offline?'Offline markaz':'Onlayn markaz')}</span><span className="cp-approved"><Check size={14} aria-hidden/>{t('Tasdiqlangan')}</span></div></div>
      </div>
      <div className="cp-intro"><p>{t(offline?'Bir manzil. Bir jamoa. Sizga mos mentor.':'Bir jamoa. Istalgan joydan o‘rganish.')}</p><a href="#center-mentors" className="btn btn-primary">{t('Mentorlarni ko‘rish')}<ArrowDown size={16} aria-hidden/></a></div>
      <dl className="cp-facts"><div><dt><Users size={17} aria-hidden/>{t('Mentorlar jamoasi')}</dt><dd>{center.mentor_count}<small>{t('ta mentor')}</small></dd></div><div><dt>{offline?<MapPin size={17} aria-hidden/>:<Globe size={17} aria-hidden/>}{t(offline?'Markaz manzili':'Ta’lim formati')}</dt><dd className="cp-fact-place">{offline?(center.city||t('Offline markaz')):t('Onlayn markaz')}<small>{offline?center.address:t('Darslar mentor bilan onlayn o‘tiladi.')}</small></dd></div></dl>
    </header>
    <OwnerTools centerId={center.id}/>
    <div className="cp-content">
      <aside className="cp-about" id="center-about"><span className="cp-eyebrow">{t('MARKAZ BILAN TANISHING')}</span><h2>{t('Markaz haqida')}</h2><p className="cp-description">{center.description}</p>{offline&&<div className="cp-location"><MapPin size={20} aria-hidden/><div><h3>{t('Manzil')}</h3><p>{[center.city,center.address].filter(Boolean).join(', ')}</p></div></div>}</aside>
      <section className="cp-team" id="center-mentors" aria-labelledby="center-team-heading"><div className="cp-team-heading"><div><span className="cp-eyebrow">{t('BIZNING JAMOA')}</span><h2 id="center-team-heading">{t('Markaz mentorlari')}</h2></div><Users size={23} aria-hidden/></div><p className="cp-team-hint">{t('Yo‘nalish, narx va bo‘sh vaqtiga qarab mentor tanlang. Har bir dars mentor bilan alohida band qilinadi va onlayn o‘tadi.')}</p>
        {mentorError&&<Notice kind="error">{t(mentorError)}<Button variant="ghost" onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</Button></Notice>}
        {!mentors?!mentorError&&<Loading/>:mentors.length?<div className="mentor-grid cp-mentor-grid">{mentors.map(m=><MentorCard key={m.id} mentor={m}/>)}</div>:<Empty title={t('Hozircha ochiq mentor yo‘q')}><p>{t('Markaz mentorlari tasdiqlangach shu yerda ko‘rinadi.')}</p></Empty>}
        {next&&<div className="center-more"><Button variant="outline" disabled={moreBusy||!!mentorError} onClick={()=>setPage(p=>p+1)}>{t(moreBusy?'Yuklanmoqda…':'Yana ko‘rsatish')}</Button></div>}
      </section>
    </div>
  </div>;
}

function OwnerTools({centerId}:{centerId:number}){
  const {user}=useAuth();const {t}=useI18n();
  const [owned,setOwned]=useState<{userId:number;center:NonNullable<MyCenter['center']>}|null>(null);
  const [open,setOpen]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId)return;
    const controller=new AbortController();setError('');setOpen(false);setOwned(null);
    api<MyCenter>('centers/mine/',{signal:controller.signal}).then(data=>{
      if(data.role==='owner'&&data.center?.id===centerId)setOwned({userId,center:data.center});
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[userId,centerId,retry]);
  if(!userId)return null;
  if(error)return <Notice kind="error">{t(error)}<Button variant="ghost" onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</Button></Notice>;
  if(!owned||owned.userId!==userId)return null;
  return <section className="cp-owner" aria-label={t('Markazni boshqarish')}><div className="cp-owner-row"><span className="cp-owner-icon"><KeyRound size={20} aria-hidden/></span><div><strong>{t('Jamoangizga mentor taklif qiling')}</strong><p>{t('Markaz egasi sifatida taklif kodini ulashishingiz mumkin.')}</p></div><Button variant="outline" aria-expanded={open} aria-controls="center-invite-code" onClick={()=>setOpen(value=>!value)}>{t(open?'Kodni yashirish':'Taklif kodini ko‘rish')}</Button><Link className="cp-manage" href="/centers/manage">{t('Boshqarish')}<ArrowUpRight size={16} aria-hidden/></Link></div>{open&&<div className="cp-owner-code" id="center-invite-code">{owned.center.invite_code&&<InviteCode code={owned.center.invite_code}/>}<p>{t('Kodni mentorga yuboring. U «O‘quv markazlari → Markazim» sahifasida kod orqali qo‘shiladi.')}</p></div>}</section>;
}
