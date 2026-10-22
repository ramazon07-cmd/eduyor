'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,ChevronLeft,ChevronRight,Pause,Play} from 'lucide-react';
import type {Mentor} from '@/lib/types';
import {Avatar} from './common';
import {money} from '@/lib/api';

export function MentorSpotlight({mentors,loading}:{mentors:Mentor[];loading:boolean}){
  const [index,setIndex]=useState(0);
  const [paused,setPaused]=useState(false);
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  useEffect(()=>{
    if(paused||hovered||focused||mentors.length<2)return;
    const timer=setInterval(()=>setIndex(i=>(i+1)%mentors.length),5000);
    return()=>clearInterval(timer);
  },[paused,hovered,focused,mentors.length,index]);
  const currentIndex=mentors.length?index%mentors.length:0;
  const mentor=mentors[currentIndex];
  if(loading)return <div className="spotlight skeleton" role="status" aria-label="Mentorlar yuklanmoqda"/>;
  if(!mentor)return <div className="spotlight"><span className="eyebrow">MENTORLIK</span><h2>Bu yerda sizning profilingiz bo‘lishi mumkin.</h2><p>Yo‘nalishingizni tanlang va mentorlikka ariza yuboring.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Mentor bo‘lish <ArrowUpRight size={18}/></Link></div>;
  return <section className="spotlight" aria-label="Mentorlar bilan tanishing" aria-roledescription="karusel" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
    <div className="spotlight-top"><span className="eyebrow">MENTORLAR BILAN TANISHING</span>{mentors.length>1&&<button type="button" onClick={()=>setPaused(p=>!p)} aria-label={paused?'Avtomatik almashtirishni yoqish':'Avtomatik almashtirishni to‘xtatish'}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>}</div>
    <div className="spotlight-profile" key={mentor.id} aria-live={paused||hovered||focused?'polite':'off'}><Avatar name={mentor.full_name} src={mentor.avatar}/><h2>{mentor.full_name}</h2><p>{mentor.headline}</p><div className="chips">{mentor.subjects.map(s=><span className="chip" key={s.id}>{s.name}</span>)}</div><div className="spotlight-price"><strong>{money(mentor.hourly_price)}</strong><span>{mentor.session_duration_minutes} daqiqalik dars</span></div><Link className="btn btn-primary" href={`/mentors/${mentor.id}`}>Mentor profilini ko‘rish <ArrowUpRight size={18}/></Link></div>
    {mentors.length>1&&<div className="spotlight-controls"><button type="button" aria-label="Oldingi mentor" onClick={()=>setIndex(i=>(i-1+mentors.length)%mentors.length)}><ChevronLeft size={19}/></button><span>{currentIndex+1} / {mentors.length}</span><button type="button" aria-label="Keyingi mentor" onClick={()=>setIndex(i=>(i+1)%mentors.length)}><ChevronRight size={19}/></button></div>}
  </section>;
}
