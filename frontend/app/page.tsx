'use client';
import {useI18n} from '@/components/i18n';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,GraduationCap} from 'lucide-react';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice} from '@/components/common';
import {MentorSpotlight} from '@/components/mentor-spotlight';
import {PromoVideo} from '@/components/promo-video';

const questions=[
  ['Dars qanday o‘tadi?','Dars 50 daqiqa, Google Meet orqali yakkama-yakka o‘tadi. To‘lov tasdiqlangach mentor yuborgan havolani dars sahifasida ko‘rasiz.'],
  ['To‘lov qanday tasdiqlanadi?','Platforma rekvizitlariga pul yuborib, to‘lov chekini yuklaysiz. Admin tushumni tekshiradi. To‘lov uchun bron 60 daqiqa saqlanadi.'],
  ['Mentor ham, o‘quvchi ham bo‘la olamanmi?','Ha. Bitta akkaunt orqali o‘rganasiz va mentorlik qilasiz. O‘zingizdan dars band qila olmaysiz.'],
  ['Narxga qo‘shimcha to‘lov qo‘shiladimi?','Yo‘q. Ko‘rsatilgan 30 000–60 000 so‘mlik narxni to‘laysiz.'],
];

export default function Home(){
  const {t:translate}=useI18n();
  const [mentors,setMentors]=useState<Mentor[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let active=true;
    api<Page<Mentor>>('mentors/').then(data=>{if(active)setMentors(data.results);}).catch(()=>{if(active)setError('Mentorlarni yuklab bo‘lmadi.');}).finally(()=>{if(active)setLoaded(true);});
    api<Subject[]>('subjects/').then(data=>{if(active)setSubjects(data);}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  return <>
    <section className="container editorial-hero">
      <div className="editorial-hero-copy">
        <h1><span>{translate("Katta maqsadlar")}</span><strong>{translate("birga boshlanadi.")}</strong></h1>
        <p>{translate("Sizga mos mentor bilan keyingi qadamingizni qo‘ying.")}</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/mentors">{translate("Mentoringizni toping")} <ArrowUpRight size={18}/></Link><Link className="text-link" href="/dashboard?tab=mentor">{translate("Men ham mentor bo‘laman")} <ArrowRight size={16}/></Link></div>
      </div>
      <MentorSpotlight mentors={mentors.slice(0,5)} loading={!loaded}/>
    </section>

    <section className="container editorial-features" aria-labelledby="features-title">
      <div className="editorial-section-heading"><h2 id="features-title">{translate("Sizga kerakli bilim.")}<br/><em>{translate("Sizga qulay usulda.")}</em></h2></div>
      <div className="feature-bento">
        <article className="bento-card bento-photo">
          <Image src="/images/learning-together.png" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 60vw" alt={translate("Yorug‘ kutubxonada birga bilim olayotgan talabalar")}/>
          <div className="bento-copy"><h3>{translate("Tushunishdan ishonchgacha.")}</h3></div>
        </article>
        <article className="bento-card bento-directions">
          <div className="bento-copy"><h3>{translate("Maqsadlar har xil.")}<br/>{translate("Yo‘lni birga topamiz.")}</h3></div>
          <div className="bento-direction-links">{subjects.map(subject=>{return <Link key={subject.id} href={`/mentors?subject=${subject.id}`}><span>{translate(subject.name)}</span><ArrowUpRight size={17}/></Link>;})}{!subjects.length&&<Link href="/mentors">{translate("Yo‘nalishlarni ko‘rish")} <ArrowUpRight size={17}/></Link>}</div>

        </article>
      </div>
    </section>

    <section id="video" className="container promo-section" aria-labelledby="promo-title">
      <div className="editorial-section-heading"><h2 id="promo-title">{translate("Bir daqiqada")}<br/><em>{translate("EduYor bilan tanishing.")}</em></h2></div>
      <div className="promo-bento">
        <article className="promo-tile"><strong>{translate("50 daqiqa")}</strong><p>{translate("Google Meet orqali yakkama-yakka dars.")}</p></article>
        <article className="promo-tile"><strong>{translate("30 000–60 000 UZS")}</strong><p>{translate("Bitta dars narxi. Qo‘shimcha to‘lov yo‘q.")}</p></article>
        <article className="promo-tile promo-tile-cta"><h3>{translate("Birinchi darsingizni bugun band qiling.")}</h3><Link className="btn btn-primary" href="/mentors">{translate("Mentor topish")} <ArrowUpRight size={18}/></Link></article>
        <PromoVideo/>
      </div>
    </section>

    <section id="mentorlar" className="container section home-mentors">
      <div className="editorial-section-heading"><h2>{translate("Bir maqsad.")}<br/><em>{translate("Mos mentor.")}</em></h2></div>
      {error&&<Notice kind="error">{translate(error)} <Link href="/mentors">{translate("Qayta urinish")}</Link></Notice>}
      <div className="mentor-grid">{mentors.slice(0,3).map(mentor=><MentorCard key={mentor.id} mentor={mentor} booking/>)}{!loaded&&[1,2,3].map(n=><div className="card skeleton" key={n} aria-label={translate("Mentor yuklanmoqda")}/>)}</div>
      {loaded&&!mentors.length&&!error&&<div className="card empty"><GraduationCap size={32}/><h3>{translate("Birinchi mentor bo‘ling")}</h3><p>{translate("Tajribangizni ulashishdan boshlang.")}</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">{translate("Mentorlikka ariza")} <ArrowUpRight size={17}/></Link></div>}
      <div className="section-center-action"><Link className="text-link" href="/mentors">{translate("Barcha mentorlar")} <ArrowRight size={17}/></Link></div>
    </section>

    <section id="qanday-ishlaydi" className="container editorial-how">
      <div className="editorial-section-heading"><h2>{translate("Uch qadam.")}<br/><em>{translate("Yangi imkoniyat.")}</em></h2></div>
      <div className="editorial-steps">{[{title:'Mentor tanlang',text:'Yo‘nalish, tajriba va ta’lim tili bo‘yicha o‘zingizga mosini toping.'},{title:'Vaqtni band qiling',text:'Qulay vaqtingizni tanlab, dars uchun to‘lov yuboring.'},{title:'Birga o‘rganing',text:'To‘lov tasdiqlangach, Google Meet’da mentor bilan uchrashing.'}].map(({title,text},i)=><article key={title}><div><span>0{i+1}</span></div><h3>{translate(title)}</h3><p>{translate(text)}</p></article>)}</div>
    </section>

    <section id="mentor-bolish" className="container editorial-teach">
      <div className="teach-editorial-copy"><h2>{translate("O‘rganing.")}<br/><em>{translate("O‘rgating.")}</em></h2><p>{translate("Bilimingiz kimningdir keyingi qadami bo‘lishi mumkin. Bitta hisob bilan ham o‘rganing, ham tajribangizni ulashing.")}</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">{translate("Mentor bo‘lish")} <ArrowUpRight size={18}/></Link></div>
    </section>

    <section id="savollar" className="container faq-section"><div><h2>{translate("Savollaringiz")}<br/><em>{translate("bormi?")}</em></h2></div><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{translate(question)}<span aria-hidden="true">+</span></summary><p>{translate(answer)}</p></details>)}</div></section>

  </>;
}
