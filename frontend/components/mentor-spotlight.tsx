'use client';
import {useI18n} from '@/components/i18n';

import Link from 'next/link';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowUpRight,ChevronLeft,ChevronRight,GraduationCap,Pause,Play} from 'lucide-react';
import type {Mentor} from '@/lib/types';
import {Avatar} from './common';
import {money} from '@/lib/api';

export function MentorSpotlight({mentors,loading}:{mentors:Mentor[];loading:boolean}){
  const {t:translate}=useI18n();
  const [index,setIndex]=useState(0);
  const [paused,setPaused]=useState(false);
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  const gallery=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(paused||hovered||focused||mentors.length<2)return;
    const timer=setInterval(()=>setIndex(i=>(i+1)%mentors.length),5000);
    return()=>clearInterval(timer);
  },[paused,hovered,focused,mentors.length,index]);
  const currentIndex=mentors.length?index%mentors.length:0;
  const mentor=mentors[currentIndex];
  useEffect(()=>{
    const container=gallery.current;
    const selected=container?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if(container&&selected&&container.scrollWidth>container.clientWidth){
      container.scrollTo({left:selected.offsetLeft-(container.clientWidth-selected.offsetWidth)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
  },[currentIndex,mentors.length]);
  if(loading)return <div className="mentor-showcase showcase-loading" role="status" aria-label={translate("Mentorlar yuklanmoqda")}><div className="showcase-fan" aria-hidden="true">{[0,1,2].map(n=><div key={n} className="showcase-placeholder skeleton"/>)}</div></div>;
  if(!mentor)return <div className="mentor-showcase showcase-empty"><GraduationCap size={45} strokeWidth={1}/><h2>{translate("Har bir tajriba — yangi imkoniyat.")}</h2><p>{translate("Yo‘nalishingizni tanlang va birinchi mentorlardan bo‘ling.")}</p><Link className="text-link" href="/dashboard?tab=mentor">{translate("Mentor bo‘lish")} <ArrowUpRight size={18}/></Link></div>;
  return <section className="mentor-showcase" aria-label={translate("Mentorlar bilan tanishing")} aria-roledescription="karusel" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
    <div className="showcase-fan" ref={gallery}>
      {mentors.map((item,slot)=>{
        const offset=slot-(mentors.length-1)/2;
        const style={'--card-tilt':`${offset*5}deg`,'--card-lift':`${Math.abs(offset)*13}px`} as CSSProperties;
        return <button key={item.id} type="button" style={style} className={`showcase-person ${slot===currentIndex?'is-active':''}`} aria-label={translate(`${item.full_name} mentorini tanlash`)} aria-pressed={slot===currentIndex} onClick={()=>setIndex(slot)}><span className="gallery-portrait"><Avatar name={item.full_name} src={item.avatar}/><span className="gallery-direction">{translate(item.subjects[0]?.name||'Mentor')}</span></span><span className="gallery-person-caption"><strong>{item.full_name}</strong><span>{item.headline}</span></span></button>;
      })}
    </div>
    <div className="showcase-detail" aria-live={paused||hovered||focused?'polite':'off'}>
      <div className="showcase-selected"><span className="eyebrow">{translate("MENTOR BILAN TANISHING")}</span><h2>{mentor.full_name}</h2><p>{mentor.headline}</p></div>
      <div className="showcase-action"><span><strong>{money(mentor.hourly_price)}</strong> / {mentor.session_duration_minutes} {translate("daqiqa")}</span><Link className="text-link" href={`/mentors/${mentor.id}`}>{translate("Profilni ko‘rish")} <ArrowUpRight size={16}/></Link></div>
      {mentors.length>1&&<div className="showcase-controls"><button type="button" aria-label={translate("Oldingi mentor")} onClick={()=>setIndex(i=>(i-1+mentors.length)%mentors.length)}><ChevronLeft size={17}/></button><span>{currentIndex+1}<span> / {mentors.length}</span></span><button type="button" aria-label={translate("Keyingi mentor")} onClick={()=>setIndex(i=>(i+1)%mentors.length)}><ChevronRight size={17}/></button><button className="showcase-pause" type="button" onClick={()=>setPaused(p=>!p)} aria-label={translate(paused?'Avtomatik almashtirishni yoqish':'Avtomatik almashtirishni to‘xtatish')}>{paused?<Play size={14}/>:<Pause size={14}/>}</button></div>}
    </div>
  </section>;
}
