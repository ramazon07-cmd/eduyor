'use client';

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
  ['To‘lov qanday tasdiqlanadi?','Platforma rekvizitlariga pul yuborib, “Pul yubordim” tugmasini bosasiz. Admin tushumni tekshiradi. To‘lov uchun bron 60 daqiqa saqlanadi.'],
  ['Mentor ham, o‘quvchi ham bo‘la olamanmi?','Ha. Bitta akkaunt orqali o‘rganasiz va mentorlik qilasiz. O‘zingizdan dars band qila olmaysiz.'],
  ['Narxga qo‘shimcha to‘lov qo‘shiladimi?','Yo‘q. Ko‘rsatilgan 30 000–60 000 so‘mlik narxni to‘laysiz.'],
];

export default function Home(){
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
        <span className="hero-kicker"><span/>Bilimga hamroh toping</span>
        <h1><span>Katta maqsadlar</span><strong>birga boshlanadi.</strong></h1>
        <p>Bir savol. Bir uchrashuv. Yangi imkoniyat.<br/>Sizga mos mentor bilan keyingi qadamingizni qo‘ying.</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/mentors">Mentoringizni toping <ArrowUpRight size={18}/></Link><Link className="text-link" href="/dashboard?tab=mentor">Men ham mentor bo‘laman <ArrowRight size={16}/></Link></div>
        <div className="hero-facts"><span><Clock3 size={15}/>50 daqiqalik dars</span><span><Video size={15}/>Google Meet</span></div>
      </div>
      <MentorSpotlight mentors={mentors.slice(0,5)} loading={!loaded}/>
    </section>

    <section className="container editorial-benefits" aria-label="Nega EduYor">
      {benefits.map(({icon:Icon,title,text})=><article key={title}><Icon size={23} strokeWidth={1.5}/><h2>{title}</h2><p>{text}</p></article>)}
    </section>

    <section className="container editorial-features" aria-labelledby="features-title">
      <div className="editorial-section-heading"><span className="eyebrow">O‘RGANISHNI OSONLASHTIRAMIZ</span><h2 id="features-title">Sizga kerakli bilim.<br/><em>Sizga qulay usulda.</em></h2><p>Ortiqcha murakkabliksiz. Birga ishlash uchun kerak bo‘lgan hammasi.</p></div>
      <div className="feature-bento">
        <article className="bento-card bento-photo">
          <Image src="/images/learning-together.png" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 60vw" alt="Yorug‘ kutubxonada birga bilim olayotgan talabalar"/>
          <div className="bento-copy"><span className="feature-label"><BookOpen size={15}/>BIRGA O‘RGANISH</span><h3>Tushunishdan ishonchgacha.</h3><p>Savol berish oson bo‘lgan muhit. Maqsadingizga bir qadam yaqinroq.</p></div>
        </article>
        <article className="bento-card bento-directions">
          <div className="bento-copy"><span className="feature-label">O‘Z YO‘NALISHINGIZNI TOPING</span><h3>Maqsadlar har xil.<br/>Yo‘lni birga topamiz.</h3></div>
          <div className="bento-direction-links">{subjects.map((subject,i)=>{const Icon=[Target,Languages,Sigma,GraduationCap][i%4];return <Link key={subject.id} href={`/mentors?subject=${subject.id}`}><span><Icon size={21} strokeWidth={1.5}/>{subject.name}</span><ArrowUpRight size={17}/></Link>;})}{!subjects.length&&<Link href="/mentors">Yo‘nalishlarni ko‘rish <ArrowUpRight size={17}/></Link>}</div>
          <p>Kerakli yo‘nalishda tajribasi bor mentorni tanlang.</p>
        </article>
        <article className="bento-card bento-time">
          <span className="feature-label"><Clock3 size={15}/>FAQAT SIZ UCHUN</span>
          <div className="lesson-duration"><strong>50</strong><span>daqiqa</span><span className="duration-orbit" aria-hidden="true"><Clock3 size={23}/></span></div>
          <div className="bento-copy"><h3>Bir mavzu. To‘liq e’tibor.</h3><p>Yakkama-yakka darsda shoshilmasdan so‘rang, tushuning va mashq qiling.</p></div>
        </article>
        <article className="bento-card bento-online">
          <div className="online-illustration" aria-hidden="true"><div className="online-window"><span className="window-caption"><span/>EduYor · onlayn dars</span><div className="online-participants"><span><GraduationCap size={40} strokeWidth={1.25}/><small>Mentor</small></span><span><BookOpen size={40} strokeWidth={1.25}/><small>Siz</small></span></div><div className="online-format"><Video size={15}/>Google Meet<span>50 daqiqa</span></div></div></div>
          <div className="bento-copy"><span className="feature-label">QAYERDA BO‘LSANGIZ HAM</span><h3>Masofa bilimga to‘siq emas.</h3><p>Qulay joyingizdan ulaning. Tasdiqlangan darsning Meet havolasi kabinetingizda turadi.</p></div>
        </article>
      </div>
    </section>

    <section id="mentorlar" className="container section home-mentors">
      <div className="editorial-section-heading"><span className="eyebrow">BILIM ORTIDA — INSONLAR</span><h2>Bir maqsad.<br/><em>Mos mentor.</em></h2><p>Siz boshlamoqchi bo‘lgan yo‘lni bosib o‘tgan insonlar bilan tanishing.</p></div>
      {error&&<Notice kind="error">{error} <Link href="/mentors">Qayta urinish</Link></Notice>}
      <div className="mentor-grid">{mentors.slice(0,3).map(mentor=><MentorCard key={mentor.id} mentor={mentor}/>)}{!loaded&&[1,2,3].map(n=><div className="card skeleton" key={n} aria-label="Mentor yuklanmoqda"/>)}</div>
      {loaded&&!mentors.length&&!error&&<div className="card empty"><GraduationCap size={32}/><h3>Birinchi mentor bo‘ling</h3><p>Tajribangizni ulashishdan boshlang.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Mentorlikka ariza <ArrowUpRight size={17}/></Link></div>}
      <div className="section-center-action"><Link className="text-link" href="/mentors">Barcha mentorlar <ArrowRight size={17}/></Link></div>
    </section>

    <section id="qanday-ishlaydi" className="container editorial-how">
      <div className="editorial-section-heading"><span className="eyebrow">BOSHLASH UCHUN</span><h2>Uch qadam.<br/><em>Yangi imkoniyat.</em></h2></div>
      <div className="editorial-steps">{[{icon:BookOpen,title:'Mentor tanlang',text:'Yo‘nalish, tajriba va ta’lim tili bo‘yicha o‘zingizga mosini toping.'},{icon:CalendarDays,title:'Vaqtni band qiling',text:'Qulay vaqtingizni tanlab, dars uchun to‘lov yuboring.'},{icon:Video,title:'Birga o‘rganing',text:'To‘lov tasdiqlangach, Google Meet’da mentor bilan uchrashing.'}].map(({icon:Icon,title,text},i)=><article key={title}><div><span>0{i+1}</span><Icon size={25} strokeWidth={1.5}/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section id="mentor-bolish" className="container editorial-teach">
      <div className="teach-editorial-art" aria-hidden="true"><BrandMark/><div className="role-pill role-learn"><BookOpen size={18}/>Bugun o‘rganaman</div><div className="role-pill role-teach"><GraduationCap size={18}/>Ertaga o‘rgataman</div></div>
      <div className="teach-editorial-copy"><span className="eyebrow">BILIM ULASHGANDA KO‘PAYADI</span><h2>O‘rganing.<br/><em>O‘rgating.</em><br/>Birga o‘sing.</h2><p>Bilimingiz kimningdir keyingi qadami bo‘lishi mumkin. Bitta hisob bilan ham o‘rganing, ham tajribangizni ulashing.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Mentor bo‘lish <ArrowUpRight size={18}/></Link></div>
    </section>

    <section id="savollar" className="container faq-section"><div><span className="eyebrow">BILISH FOYDALI</span><h2>Savollaringiz<br/><em>bormi?</em></h2><p>Boshlash uchun kerakli javoblar.</p></div><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="container"><div className="closing-banner"><span className="eyebrow">KEYINGI QADAM SIZDAN</span><h2>Hamrohingizni toping.<br/><em>Birga balandroqqa.</em></h2><p>Katta maqsadni kichik bir uchrashuvdan boshlang.</p><Link className="btn btn-primary" href="/mentors">Mentor topish <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
