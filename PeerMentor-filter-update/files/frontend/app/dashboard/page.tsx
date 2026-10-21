'use client';
import Link from 'next/link';
import {useEffect,useState,useCallback} from 'react';
import {BookOpen,GraduationCap,CalendarDays,Wallet,ArrowUpRight,Video} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {api,money,when,statusLabel} from '@/lib/api';
import type {Booking,Page} from '@/lib/types';
import {Loading,LoginRequired,Empty,Notice} from '@/components/common';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {MentorForm} from '@/components/mentor-settings';
const tabs=[{id:'lessons',label:'Darslarim',icon:BookOpen},{id:'mentor',label:'Mentor profilim',icon:GraduationCap},{id:'earnings',label:'Daromadim',icon:Wallet}];
export default function Dashboard(){
  const {user,loading}=useAuth();const [tab,setTab]=useState('lessons');
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get('tab');if(tabs.some(t=>t.id===requested))setTab(requested!);},[]);
  if(loading)return <Loading/>;if(!user)return <LoginRequired next={tab==='mentor'?'/dashboard?tab=mentor':'/dashboard'}/>;
  return <div className="container section"><div className="page-heading"><span className="eyebrow">SHAXSIY MAYDON</span><h1>Salom, {user.profile.full_name.split(' ')[0]}<span className="violet">.</span></h1><p>O‘rganish va o‘rgatish — bir joyda.</p></div><div className="dashboard-layout"><nav className="dashboard-nav" aria-label="Shaxsiy bo‘limlar">{tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)} aria-current={tab===t.id?'page':undefined}><t.icon size={18}/>{t.label}</button>)}<Link href="/profile">Profilni tahrirlash <ArrowUpRight size={15}/></Link></nav><div className="dashboard-content">{tab==='lessons'?<Lessons/>:tab==='mentor'?<MentorForm/>:<Earnings/>}</div></div></div>;
}
function Lessons(){
  const {user}=useAuth();const [data,setData]=useState<Page<Booking>|null>(null);const [page,setPage]=useState(1);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setBusy(true);setError('');try{setData(await api<Page<Booking>>(`bookings/?page=${page}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}},[page]);useEffect(()=>{void load();const timer=setInterval(()=>{api<Page<Booking>>(`bookings/?page=${page}`).then(setData).catch(()=>{});},20000);return()=>clearInterval(timer);},[load,page]);
  if(!user)return null;const student=data?.results.filter(b=>b.student===user.id)||[];const mentor=data?.results.filter(b=>b.mentor===user.id)||[];
  return <>{error&&<Notice kind="error">{error}<button onClick={load}>Qayta urinish</button></Notice>}{busy?<Loading/>:data&&!data.count?<Empty title="Birinchi darsingiz oldinda"><p>Maqsadingizga mos mentor bilan boshlang.</p><Link href="/mentors" className="btn btn-primary">Mentor topish <ArrowUpRight size={16}/></Link></Empty>:<>{[{title:'O‘rganaman',rows:student,teaching:false},{title:'Dars beraman',rows:mentor,teaching:true}].map(({title,rows,teaching})=><section className="lesson-section" key={title}><h2>{title}<span className="muted small"> · shu sahifadagi darslar</span></h2>{rows.length?rows.map(b=><Link key={b.id} href={`/sessions/${b.id}`} className="lesson-card"><span className="lesson-icon"><CalendarDays size={21}/></span><div><strong>{teaching?b.student_name:b.mentor_name}</strong><p>{when(b.starts_at,user.profile.timezone)} · 60 daqiqa</p><span className="tiny muted">{user.profile.timezone}</span>{b.status==='confirmed'&&<span className={`lesson-meet-hint ${b.meeting_url?'ready':''}`}><Video size={12}/>{b.meeting_url?'Google Meet tayyor · Darsni ochish →':teaching?'Google Meet havolasini qo‘shing →':'Mentor havola yuborishini kuting'}</span>}</div><div className="lesson-end"><span className={`status status-${b.status}`}>{statusLabel[b.status]}</span><span className="small">{money(b.total_price)} <ArrowUpRight size={14}/></span>{b.disputed&&<span className="tiny">Admin ko‘rib chiqmoqda</span>}</div></Link>):<p className="muted small">Bu sahifada ushbu roldagi dars yo‘q.</p>}</section>)}{data&&data.count>20&&<div className="pagination"><Button variant="outline" disabled={!data.previous} onClick={()=>setPage(p=>p-1)}>Oldingi</Button><span>{page}</span><Button variant="outline" disabled={!data.next} onClick={()=>setPage(p=>p+1)}>Keyingi</Button></div>}</>}</>;
}
function Earnings(){
  const [data,setData]=useState<Record<string,string>|null>(null);const [error,setError]=useState('');const load=useCallback(()=>{setError('');api<Record<string,string>>('earnings/').then(setData).catch(e=>setError(e.message));},[]);useEffect(load,[load]);
  return <>{error?<Notice kind="error">{error}<button onClick={load}>Qayta urinish</button></Notice>:!data?<Loading/>:<><h2>Daromadim</h2><p className="muted">Faqat to‘lovi tekshirilgan, yakunlangan va nizosiz darslar hisoblanadi.</p><div className="earnings-grid">{[['gross','Darslar qiymati'],['platform_fee','Platforma komissiyasi'],['net_earned','Sof daromad'],['pending_payout','O‘tkazilishi kutilmoqda'],['paid','To‘langan']].map(([k,label])=><Card key={k} className={`earning-card ${k==='net_earned'?'earning-highlight':''}`}><p>{label}</p><strong>{money(data[k])}</strong></Card>)}</div><Notice>Mentor to‘lovlari admin tomonidan qo‘lda o‘tkaziladi. Dars tugaganini o‘quvchi tasdiqlashi kerak; vaqt tugashining o‘zi yetarli emas.</Notice></>}</>;
}
