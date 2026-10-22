'use client';
import {useI18n} from '@/components/i18n';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,CalendarDays,Clock3,GraduationCap,Languages,Sigma,Target,Video} from 'lucide-react';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice} from '@/components/common';
import {MentorSpotlight} from '@/components/mentor-spotlight';
import {BrandMark} from '@/components/brand';

const benefits=[
  {icon:Target,title:'Aynan sizga kerakli mavzu',text:'Biladiganingizni takrorlamang. Tushunmagan joyingizdan boshlang.'},
  {icon:CalendarDays,title:'Rejangizga mos uchrashuv',text:'Qulay kun va vaqtni tanlang. O‘rganish hayotingizga moslashsin.'},
  {icon:GraduationCap,title:'Tajribadan o‘rganing',text:'Shu yo‘ldan o‘tgan mentor bilan keyingi qadamingizni qo‘ying.'},
];
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
        <span className="hero-kicker"><span/>{translate("Bilimga hamroh toping")}</span>
        <h1><span>{translate("Katta maqsadlar")}</span><strong>{translate("birga boshlanadi.")}</strong></h1>
        <p>{translate("Bir savol. Bir uchrashuv. Yangi imkoniyat.")}<br/>{translate("Sizga mos mentor bilan keyingi qadamingizni qo‘ying.")}</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/mentors">{translate("Mentoringizni toping")} <ArrowUpRight size={18}/></Link><Link className="text-link" href="/dashboard?tab=mentor">{translate("Men ham mentor bo‘laman")} <ArrowRight size={16}/></Link></div>
        <div className="hero-facts"><span><Clock3 size={15}/>{translate("50 daqiqalik dars")}</span><span><Video size={15}/>{translate("Google Meet")}</span></div>
      </div>
      <MentorSpotlight mentors={mentors.slice(0,5)} loading={!loaded}/>
    </section>

    <section className="container editorial-benefits" aria-label={translate("Nega EduYor")}>
      {benefits.map(({icon:Icon,title,text})=><article key={title}><Icon size={23} strokeWidth={1.5}/><h2>{translate(title)}</h2><p>{translate(text)}</p></article>)}
    </section>

    <section className="container editorial-features" aria-labelledby="features-title">
      <div className="editorial-section-heading"><span className="eyebrow">{translate("O‘RGANISHNI OSONLASHTIRAMIZ")}</span><h2 id="features-title">{translate("Sizga kerakli bilim.")}<br/><em>{translate("Sizga qulay usulda.")}</em></h2><p>{translate("Ortiqcha murakkabliksiz. Birga ishlash uchun kerak bo‘lgan hammasi.")}</p></div>
      <div className="feature-bento">
        <article className="bento-card bento-photo">
          <Image src="/images/learning-together.png" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 60vw" alt={translate("Yorug‘ kutubxonada birga bilim olayotgan talabalar")}/>
          <div className="bento-copy"><span className="feature-label"><BookOpen size={15}/>{translate("BIRGA O‘RGANISH")}</span><h3>{translate("Tushunishdan ishonchgacha.")}</h3><p>{translate("Savol berish oson bo‘lgan muhit. Maqsadingizga bir qadam yaqinroq.")}</p></div>
        </article>
        <article className="bento-card bento-directions">
          <div className="bento-copy"><span className="feature-label">{translate("O‘Z YO‘NALISHINGIZNI TOPING")}</span><h3>{translate("Maqsadlar har xil.")}<br/>{translate("Yo‘lni birga topamiz.")}</h3></div>
          <div className="bento-direction-links">{subjects.map((subject,i)=>{const Icon=[Target,Languages,Sigma,GraduationCap][i%4];return <Link key={subject.id} href={`/mentors?subject=${subject.id}`}><span><Icon size={21} strokeWidth={1.5}/>{translate(subject.name)}</span><ArrowUpRight size={17}/></Link>;})}{!subjects.length&&<Link href="/mentors">{translate("Yo‘nalishlarni ko‘rish")} <ArrowUpRight size={17}/></Link>}</div>
          <p>{translate("Kerakli yo‘nalishda tajribasi bor mentorni tanlang.")}</p>
        </article>
        <article className="bento-card bento-time">
          <span className="feature-label"><Clock3 size={15}/>{translate("FAQAT SIZ UCHUN")}</span>
          <div className="lesson-duration"><strong>50</strong><span>{translate("daqiqa")}</span><span className="duration-orbit" aria-hidden="true"><Clock3 size={23}/></span></div>
          <div className="bento-copy"><h3>{translate("Bir mavzu. To‘liq e’tibor.")}</h3><p>{translate("Yakkama-yakka darsda shoshilmasdan so‘rang, tushuning va mashq qiling.")}</p></div>
        </article>
        <article className="bento-card bento-online">
          <div className="online-illustration" aria-hidden="true"><div className="online-window"><span className="window-caption"><span/>{translate("EduYor · onlayn dars")}</span><div className="online-participants"><span><GraduationCap size={40} strokeWidth={1.25}/><small>{translate("Mentor")}</small></span><span><BookOpen size={40} strokeWidth={1.25}/><small>{translate("Siz")}</small></span></div><div className="online-format"><Video size={15}/>{translate("Google Meet")}<span>{translate("50 daqiqa")}</span></div></div></div>
          <div className="bento-copy"><span className="feature-label">{translate("QAYERDA BO‘LSANGIZ HAM")}</span><h3>{translate("Masofa bilimga to‘siq emas.")}</h3><p>{translate("Qulay joyingizdan ulaning. Tasdiqlangan darsning Meet havolasi kabinetingizda turadi.")}</p></div>
        </article>
      </div>
    </section>

    <section id="mentorlar" className="container section home-mentors">
      <div className="editorial-section-heading"><span className="eyebrow">{translate("BILIM ORTIDA — INSONLAR")}</span><h2>{translate("Bir maqsad.")}<br/><em>{translate("Mos mentor.")}</em></h2><p>{translate("Siz boshlamoqchi bo‘lgan yo‘lni bosib o‘tgan insonlar bilan tanishing.")}</p></div>
      {error&&<Notice kind="error">{translate(error)} <Link href="/mentors">{translate("Qayta urinish")}</Link></Notice>}
      <div className="mentor-grid">{mentors.slice(0,3).map(mentor=><MentorCard key={mentor.id} mentor={mentor}/>)}{!loaded&&[1,2,3].map(n=><div className="card skeleton" key={n} aria-label={translate("Mentor yuklanmoqda")}/>)}</div>
      {loaded&&!mentors.length&&!error&&<div className="card empty"><GraduationCap size={32}/><h3>{translate("Birinchi mentor bo‘ling")}</h3><p>{translate("Tajribangizni ulashishdan boshlang.")}</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">{translate("Mentorlikka ariza")} <ArrowUpRight size={17}/></Link></div>}
      <div className="section-center-action"><Link className="text-link" href="/mentors">{translate("Barcha mentorlar")} <ArrowRight size={17}/></Link></div>
    </section>

    <section id="qanday-ishlaydi" className="container editorial-how">
      <div className="editorial-section-heading"><span className="eyebrow">{translate("BOSHLASH UCHUN")}</span><h2>{translate("Uch qadam.")}<br/><em>{translate("Yangi imkoniyat.")}</em></h2></div>
      <div className="editorial-steps">{[{icon:BookOpen,title:'Mentor tanlang',text:'Yo‘nalish, tajriba va ta’lim tili bo‘yicha o‘zingizga mosini toping.'},{icon:CalendarDays,title:'Vaqtni band qiling',text:'Qulay vaqtingizni tanlab, dars uchun to‘lov yuboring.'},{icon:Video,title:'Birga o‘rganing',text:'To‘lov tasdiqlangach, Google Meet’da mentor bilan uchrashing.'}].map(({icon:Icon,title,text},i)=><article key={title}><div><span>0{i+1}</span><Icon size={25} strokeWidth={1.5}/></div><h3>{translate(title)}</h3><p>{translate(text)}</p></article>)}</div>
    </section>

    <section id="mentor-bolish" className="container editorial-teach">
      <div className="teach-editorial-art" aria-hidden="true"><BrandMark/><div className="role-pill role-learn"><BookOpen size={18}/>{translate("Bugun o‘rganaman")}</div><div className="role-pill role-teach"><GraduationCap size={18}/>{translate("Ertaga o‘rgataman")}</div></div>
      <div className="teach-editorial-copy"><span className="eyebrow">{translate("BILIM ULASHGANDA KO‘PAYADI")}</span><h2>{translate("O‘rganing.")}<br/><em>{translate("O‘rgating.")}</em><br/>{translate("Birga o‘sing.")}</h2><p>{translate("Bilimingiz kimningdir keyingi qadami bo‘lishi mumkin. Bitta hisob bilan ham o‘rganing, ham tajribangizni ulashing.")}</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">{translate("Mentor bo‘lish")} <ArrowUpRight size={18}/></Link></div>
    </section>

    <section id="savollar" className="container faq-section"><div><span className="eyebrow">{translate("BILISH FOYDALI")}</span><h2>{translate("Savollaringiz")}<br/><em>{translate("bormi?")}</em></h2><p>{translate("Boshlash uchun kerakli javoblar.")}</p></div><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{translate(question)}<span aria-hidden="true">+</span></summary><p>{translate(answer)}</p></details>)}</div></section>
    <section className="container"><div className="closing-banner"><span className="eyebrow">{translate("KEYINGI QADAM SIZDAN")}</span><h2>{translate("Hamrohingizni toping.")}<br/><em>{translate("Birga balandroqqa.")}</em></h2><p>{translate("Katta maqsadni kichik bir uchrashuvdan boshlang.")}</p><Link className="btn btn-primary" href="/mentors">{translate("Mentor topish")} <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
