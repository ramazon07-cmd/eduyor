'use client';
import {useI18n} from '@/components/i18n';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Building2,GraduationCap} from 'lucide-react';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {Notice} from '@/components/common';
import {useAuthHref} from '@/components/auth';
import {MentorPreview} from '@/components/mentor-preview';
import {MentorSpotlight} from '@/components/mentor-spotlight';
import {PromoVideo} from '@/components/promo-video';
import {CenterPreview} from '@/components/center-preview';
import {LessonCall} from '@/components/lesson-call';
import type {Center} from '@/lib/centers';

const questions=[
  ['Dars qanday o‘tadi?','Dars 50 daqiqa, Google Meet orqali yakkama-yakka o‘tadi. To‘lov tasdiqlangach mentor yuborgan havolani dars sahifasida ko‘rasiz.'],
  ['To‘lov qanday tasdiqlanadi?','Platforma rekvizitlariga pul yuborib, to‘lov chekini yuklaysiz. Admin tushumni tekshiradi. To‘lov uchun bron 60 daqiqa saqlanadi.'],
  ['Mentor ham, o‘quvchi ham bo‘la olamanmi?','Ha. Bitta akkaunt orqali o‘rganasiz va mentorlik qilasiz. O‘zingizdan dars band qila olmaysiz.'],
  ['Narxga qo‘shimcha to‘lov qo‘shiladimi?','Yo‘q. Ko‘rsatilgan 30 000–60 000 so‘mlik narxni to‘laysiz.'],
];

// The hero fan shows the earliest mentors who uploaded a photo; the full list stays in the mentors section below.
const SPOTLIGHT_SIZE=7;

export default function Home(){
  const {t:translate}=useI18n();
  const authHref=useAuthHref();
  const [mentors,setMentors]=useState<Mentor[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [centers,setCenters]=useState<Center[]>([]);
  const [centersLoading,setCentersLoading]=useState(true);
  const [centersError,setCentersError]=useState(false);
  const [centersRetry,setCentersRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setCentersLoading(true);
    setCentersError(false);
    api<Page<Center>>('centers/').then(data=>{
      if(active)setCenters(data.results.slice(0,3));
    }).catch(()=>{if(active)setCentersError(true);}).finally(()=>{if(active)setCentersLoading(false);});
    return()=>{active=false;};
  },[centersRetry]);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let active=true;
    (async()=>{
      const all:Mentor[]=[];
      let page=1;
      while(active){
        const data=await api<Page<Mentor>>(`mentors/?page=${page}`);
        all.push(...data.results);
        if(!data.next)break;
        page+=1;
      }
      if(active)setMentors(all);
    })().catch(()=>{if(active)setError('Mentorlarni yuklab bo‘lmadi.');}).finally(()=>{if(active)setLoaded(true);});
    api<Subject[]>('subjects/').then(data=>{if(active)setSubjects(data);}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const spotlightMentors=mentors.filter(mentor=>mentor.avatar).sort((a,b)=>a.id-b.id).slice(0,SPOTLIGHT_SIZE);
  return <>
    <section className="container editorial-hero">
      <div className="editorial-hero-copy">
        <h1><span>{translate("Katta maqsadlar")}</span><strong>{translate("birga boshlanadi.")}</strong></h1>
        <p>{translate("Sizga mos mentor bilan keyingi qadamingizni qo‘ying.")}</p>
        <div className="hero-actions"><Link className="btn btn-primary" href={authHref('/mentors')}>{translate("Mentoringizni toping")} <ArrowUpRight size={18}/></Link><Link className="text-link" href="#markazlar">{translate("O‘quv markazlari")} <ArrowUpRight size={16}/></Link></div>
      </div>
      <MentorSpotlight mentors={spotlightMentors} loading={!loaded}/>
    </section>

    <section className="container editorial-features" aria-labelledby="features-title">
      <div className="editorial-section-heading"><h2 id="features-title">{translate("Sizga kerakli bilim.")}<br/><em>{translate("Sizga qulay usulda.")}</em></h2></div>
      <div className="feature-bento">
        <article className="bento-card bento-photo">
          <LessonCall mentors={mentors}/>
          <div className="bento-copy"><h3>{translate("Tushunishdan ishonchgacha.")}</h3></div>
        </article>
        <article className="bento-card bento-directions">
          <div className="bento-copy"><h3>{translate("Maqsadlar har xil.")}<br/>{translate("Yo‘lni birga topamiz.")}</h3></div>
          <div className="bento-direction-links">{subjects.map(subject=>{return <Link key={subject.id} href={authHref(`/mentors?subject=${subject.id}`)}><span>{translate(subject.name)}</span><ArrowUpRight size={17}/></Link>;})}{!subjects.length&&<Link href={authHref('/mentors')}>{translate("Yo‘nalishlarni ko‘rish")} <ArrowUpRight size={17}/></Link>}</div>

        </article>
      </div>
    </section>

    <section id="video" className="container promo-section" aria-labelledby="promo-title">
      <div className="editorial-section-heading"><h2 id="promo-title">{translate("Bir daqiqada")}<br/><em>{translate("EduYor qanday ishlaydi?")}</em></h2></div>
      <div className="promo-bento">
        <article className="promo-tile"><strong>{translate("50 daqiqa")}</strong><p>{translate("Google Meet orqali yakkama-yakka dars.")}</p></article>
        <article className="promo-tile"><strong>{translate("30 000–60 000 UZS")}</strong><p>{translate("Bitta dars narxi. Qo‘shimcha to‘lov yo‘q.")}</p></article>
        <article className="promo-tile promo-tile-schedule"><strong>{translate("Vaqtni band qiling")}</strong><p>{translate("Qulay vaqtingizni tanlab, dars uchun to‘lov yuboring.")}</p></article>
        <PromoVideo/>
      </div>
    </section>

    <section id="mentorlar" className="container section home-mentors">
      <div className="editorial-section-heading"><h2>{translate("Bir maqsad.")}<br/><em>{translate("Mos mentor.")}</em></h2></div>
      {error&&<Notice kind="error">{translate(error)} <Link href={authHref('/mentors')}>{translate("Qayta urinish")}</Link></Notice>}
      {(!loaded||mentors.length>0)&&<MentorPreview mentors={mentors} loading={!loaded}/>}
      {loaded&&!mentors.length&&!error&&<div className="card empty"><GraduationCap size={32}/><h3>{translate("Birinchi mentor bo‘ling")}</h3><p>{translate("Tajribangizni ulashishdan boshlang.")}</p></div>}
    </section>

    <section id="markazlar" className="container section home-mentors home-centers" aria-labelledby="centers-title">
      <div className="editorial-section-heading"><h2 id="centers-title">{translate("O‘quv markazlari")}</h2><p>{translate("Bir jamoa. Istalgan joydan o‘rganish.")}</p><Link className="text-link center-directory-link" href={authHref('/centers')}>{translate("Barcha markazlar")} <ArrowUpRight size={17}/></Link></div>
      {centersLoading?<div className="cp-row" role="status" aria-label={translate("O‘quv markazlari yuklanmoqda")}><span className="sr-only">{translate("O‘quv markazlari yuklanmoqda")}</span>{[0,1,2].map(n=><div key={n} className="cp-card cp-skeleton skeleton" aria-hidden="true"/>)}</div>:centersError?<Notice kind="error">{translate("O‘quv markazlarini yuklab bo‘lmadi.")} <button type="button" onClick={()=>setCentersRetry(n=>n+1)}>{translate("Qayta urinish")}</button></Notice>:centers.length>0?<CenterPreview centers={centers} href={authHref}/>:<div className="center-empty" role="status"><Building2 size={30} aria-hidden="true"/><h3>{translate("Hozircha tasdiqlangan markaz yo‘q")}</h3><p>{translate("Tasdiqlangan o‘quv markazlari shu yerda ko‘rinadi.")}</p></div>}
    </section>

    <section id="qanday-ishlaydi" className="container editorial-how">
      <div className="editorial-section-heading"><h2>{translate("Uch qadam.")}<br/><em>{translate("Yangi imkoniyat.")}</em></h2></div>
      <div className="editorial-steps">{[{title:'Mentor tanlang',text:'Yo‘nalish, tajriba va ta’lim tili bo‘yicha o‘zingizga mosini toping.'},{title:'Vaqtni band qiling',text:'Qulay vaqtingizni tanlab, dars uchun to‘lov yuboring.'},{title:'Birga o‘rganing',text:'To‘lov tasdiqlangach, Google Meet’da mentor bilan uchrashing.'}].map(({title,text},i)=><article key={title}><div><span>0{i+1}</span></div><h3>{translate(title)}</h3><p>{translate(text)}</p></article>)}</div>
    </section>

    <section id="mentor-bolish" className="container editorial-teach">
      <div className="teach-editorial-copy"><h2>{translate("O‘rganing.")}<br/><em>{translate("O‘rgating.")}</em></h2><p>{translate("Bilimingiz kimningdir keyingi qadami bo‘lishi mumkin. Bitta hisob bilan ham o‘rganing, ham tajribangizni ulashing.")}</p><Link className="btn btn-primary" href={authHref('/dashboard?tab=mentor')}>{translate("Mentor bo‘lish")} <ArrowUpRight size={18}/></Link></div>
    </section>

    <section id="savollar" className="container faq-section"><div><h2>{translate("Savollaringiz")}<br/><em>{translate("bormi?")}</em></h2></div><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{translate(question)}<span aria-hidden="true">+</span></summary><p>{translate(answer)}</p></details>)}</div></section>

  </>;
}
