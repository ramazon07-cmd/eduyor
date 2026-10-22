'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,BookOpen,CalendarDays,Clock3,Video} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {Empty,Loading,LoginRequired,Notice} from '@/components/common';
import {api,when,statusLabel} from '@/lib/api';
import type {Booking,Page} from '@/lib/types';

export default function StudentHome(){
  const {user,loading}=useAuth();
  const [data,setData]=useState<{total:number;completed:number;pending:number;upcoming:Booking[]}|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!user)return;
    let active=true;
    setData(null);setError('');
    async function load(){
      const [all,completed,pending]=await Promise.all([
        api<Page<Booking>>('bookings/?role=learning'),
        api<Page<Booking>>('bookings/?role=learning&status=completed'),
        api<Page<Booking>>('bookings/?role=learning&status=pending_payment'),
      ]);
      const confirmed:Booking[]=[];
      let page=1;
      while(active){
        const result=await api<Page<Booking>>(`bookings/?role=learning&status=confirmed&page=${page}`);
        confirmed.push(...result.results);
        if(!result.next)break;
        page++;
      }
      if(active)setData({total:all.count,completed:completed.count,pending:pending.count,upcoming:confirmed.filter(b=>new Date(b.ends_at).getTime()>Date.now()).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))});
    }
    void load().catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[user?.id,retry]);
  if(loading)return <Loading/>;
  if(!user)return <LoginRequired next="/dashboard/home"/>;
  const next=data?.upcoming[0];
  return <div className="student-home">
    <header className="workspace-heading"><div><span className="eyebrow">SIZNING O‘QUV MAYDONINGIZ</span><h1>Salom, {user.profile.full_name.split(' ')[0]}</h1><p>Keyingi darsingiz va o‘rganish rejangiz shu yerda.</p></div><Link href="/mentors" className="btn btn-primary">Mentor topish <ArrowUpRight size={17}/></Link></header>
    {error?<Notice kind="error">{error}<button onClick={()=>setRetry(n=>n+1)}>Qayta urinish</button></Notice>:!data?<div className="skeleton" role="status" aria-label="Darslar yuklanmoqda"/>:<>
      <div className="student-stats">{[[data.total,'Jami darslar'],[data.upcoming.length,'Yaqin darslar'],[data.completed,'Yakunlangan'],[data.pending,'To‘lov kutilmoqda']].map(([value,label])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="student-home-grid"><section className="card student-next"><span className="eyebrow">KEYINGI DARSINGIZ</span>{next?<><h2>{next.mentor_name} bilan dars</h2><p><CalendarDays size={18}/>{when(next.starts_at,user.profile.timezone)}</p><p><Clock3 size={18}/>{next.duration_minutes} daqiqa · {user.profile.timezone}</p><p><Video size={18}/>{next.meeting_url?'Google Meet havolasi tayyor':'Mentor Meet havolasini yuboradi'}</p>{next.objective&&<blockquote>{next.objective}</blockquote>}<Link className="btn btn-primary" href={`/sessions/${next.id}`}>Darsni ochish <ArrowUpRight size={17}/></Link></>:<Empty title="Keyingi darsingizni rejalang"><p>Kerakli fan bo‘yicha mentor tanlang va qulay vaqtni band qiling.</p><Link className="btn btn-primary" href="/mentors">Mentorlarni ko‘rish <ArrowUpRight size={17}/></Link></Empty>}</section>
      <aside className="card student-shortcuts"><h2>O‘rganishni davom ettiring</h2><Link href="/dashboard"><BookOpen size={21}/><span><strong>Darslarim</strong><small>Barcha darslar va to‘lov holati</small></span><ArrowUpRight size={18}/></Link><Link href="/profile"><CalendarDays size={21}/><span><strong>Maqsadlarim</strong><small>Profil va o‘rganish maqsadini yangilash</small></span><ArrowUpRight size={18}/></Link><div className="student-goal"><span className="eyebrow">O‘RGANISH MAQSADINGIZ</span><p>{user.profile.learning_goals||'Maqsadingizni profilingizga yozing. Mentor bilan darsga tayyorlanish shundan boshlanadi.'}</p></div></aside></div>
      {data.pending>0&&<Notice>{data.pending} ta dars to‘lovni kutmoqda. Bron muddati tugashidan oldin <Link href="/dashboard">dars tafsilotlarini oching</Link>.</Notice>}
      {data.upcoming.length>1&&<section className="student-upcoming"><div className="section-heading"><h2>Rejalashtirilgan darslar</h2><Link className="text-link" href="/dashboard">Barchasini ko‘rish <ArrowUpRight size={17}/></Link></div>{data.upcoming.slice(1,4).map(b=><Link key={b.id} href={`/sessions/${b.id}`}><CalendarDays size={22}/><span><strong>{b.mentor_name}</strong><small>{when(b.starts_at,user.profile.timezone)}</small></span><span className={`status status-${b.status}`}>{statusLabel[b.status]}</span><ArrowUpRight size={18}/></Link>)}</section>}
    </>}
  </div>;
}
