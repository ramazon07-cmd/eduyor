'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,CalendarDays,Clock3,GraduationCap,ShieldCheck,Video} from 'lucide-react';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice} from '@/components/common';
import {MentorSpotlight} from '@/components/mentor-spotlight';
import {BrandMark} from '@/components/brand';

export default function Home(){
  const [mentors,setMentors]=useState<Mentor[]>([]);const [subjects,setSubjects]=useState<Subject[]>([]);
  const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    api<Page<Mentor>>('mentors/').then(d=>setMentors(d.results)).catch(()=>setError('Mentorlarni yuklab bo‘lmadi.')).finally(()=>setLoaded(true));
    api<Subject[]>('subjects/').then(setSubjects).catch(()=>{});
  },[]);
  return <>
    <section className="container brand-hero">
      <div className="brand-hero-copy"><span className="hero-kicker"><span/>Bilimga hamroh toping</span><h1>Katta maqsadlar<br/><em>birga boshlanadi.</em></h1><p>Tushunmagan mavzuni ortga surmang. Sizga mos mentor bilan yakkama-yakka o‘rganing va keyingi qadamingizni ishonch bilan qo‘ying.</p><div className="hero-actions"><Link className="btn btn-primary" href="/mentors">Mentor topish <ArrowUpRight size={19}/></Link><Link className="text-link" href="/dashboard?tab=mentor">Mentor bo‘lish <ArrowRight size={17}/></Link></div><div className="hero-facts"><span><Clock3 size={16}/>50 daqiqalik dars</span><span><Video size={16}/>Google Meet</span></div></div>
      <MentorSpotlight mentors={mentors} loading={!loaded}/>
    </section>
    <div className="container"><div className="subject-strip"><span>Qaysi yo‘nalish sizniki?</span><div>{!subjects.length&&<Link href="/mentors">Yo‘nalishlarni ko‘rish<ArrowUpRight size={14}/></Link>}{subjects.map(s=><Link key={s.id} href={`/mentors?subject=${s.id}`}>{s.name}<ArrowUpRight size={14}/></Link>)}</div></div></div>
    <section className="container landing-benefits" aria-label="Nega EduYor"><div><span className="eyebrow">O‘ZINGIZGA QULAY USULDA</span><h2>Hamma uchun bir xil dars emas.</h2></div><div><article><BookOpen size={22}/><h3>Aynan sizga kerakli mavzu</h3><p>Biladiganingizni takrorlash o‘rniga, tushunmagan joyingiz ustida ishlang.</p></article><article><CalendarDays size={22}/><h3>Rejangizga mos uchrashuv</h3><p>Mentorning bo‘sh vaqtlari orasidan o‘zingizga qulayini tanlang.</p></article></div></section>
    <section id="mentorlar" className="container section home-mentors"><div className="section-heading"><div><span className="eyebrow">SIZGA MOS TAJRIBA</span><h2>Bir maqsad. Mos mentor.</h2><p>50 daqiqa · 30 000–60 000 so‘m · yakkama-yakka</p></div><Link className="text-link" href="/mentors">Barcha mentorlar <ArrowRight size={18}/></Link></div>{error&&<Notice kind="error">{error} <Link href="/mentors">Qayta urinish</Link></Notice>}<div className="mentor-grid">{mentors.slice(0,3).map(m=><MentorCard key={m.id} mentor={m}/>)}{!loaded&&[1,2,3].map(n=><div className="card skeleton" key={n} aria-label="Mentor yuklanmoqda"/>)}</div>{loaded&&!mentors.length&&!error&&<div className="card empty"><GraduationCap size={32}/><h3>Birinchi mentor bo‘ling</h3><p>Tajribangizni ulashishdan boshlang.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Mentorlikka ariza <ArrowUpRight size={17}/></Link></div>}</section>
    <section id="qanday-ishlaydi" className="container"><div className="how-panel"><div><span className="eyebrow">HAMMASI ODDIY</span><h2>Uch qadam.<br/>Yangi imkoniyat.</h2></div><div className="how-grid">{[[BookOpen,'01','Mentor tanlang','Yo‘nalish va til bo‘yicha toping.'],[CalendarDays,'02','Vaqtni band qiling','Qulay sanani tanlab, to‘lov yuboring.'],[Video,'03','Birga o‘rganing','To‘lov tasdiqlangach Meet’da uchrashing.']].map(([Icon,n,title,description])=>{const StepIcon=Icon as typeof BookOpen;return <div key={String(n)}><div className="how-icon"><StepIcon size={24}/><small>{String(n)}</small></div><h3>{String(title)}</h3><p>{String(description)}</p></div>;})}</div></div></section>
    <section id="mentor-bolish" className="container teach-section"><div className="teach-copy"><span className="eyebrow">BILIM ULASHGANDA KO‘PAYADI</span><h2>O‘rganing.<br/><em>O‘rgating.</em><br/>Birga o‘sing.</h2><p>Bitta akkaunt — ikkita imkoniyat. O‘zingizga kerakli yo‘nalishda o‘rganing, tajribangiz bor yo‘nalishda mentor bo‘ling.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Men ham mentor bo‘laman <ArrowUpRight size={18}/></Link></div><div className="teach-brand-card"><BrandMark label="EduYor mentorlik"/><div><ShieldCheck size={22}/><span>Yangi darsdan<strong>80% sizga · 20% platformaga</strong></span></div></div></section>
    <section id="savollar" className="container faq-section"><div><span className="eyebrow">BILISH FOYDALI</span><h2>Savollaringiz bormi?</h2><p>Boshlash uchun kerakli javoblar.</p></div><div className="faq-list">{[['Dars qanday o‘tadi?','Dars 50 daqiqa, Google Meet orqali yakkama-yakka o‘tadi. To‘lov tasdiqlangach mentor yuborgan havolani dars sahifasida ko‘rasiz.'],['To‘lov qanday tasdiqlanadi?','Platforma rekvizitlariga pul yuborib, “Pul yubordim” tugmasini bosasiz. Tranzaksiya raqami ixtiyoriy. Admin tushumni tekshiradi. To‘lov uchun bron 60 daqiqa saqlanadi.'],['Mentor ham, o‘quvchi ham bo‘la olamanmi?','Ha. Bitta akkaunt orqali o‘rganasiz va mentorlik qilasiz. O‘zingizdan dars band qila olmaysiz.'],['Narxga qo‘shimcha to‘lov qo‘shiladimi?','Yo‘q. Ko‘rsatilgan 30 000–60 000 so‘mlik narxni to‘laysiz. Platforma ulushi shu summaning ichida.']].map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="container"><div className="closing-banner"><div><span>KEYINGI QADAM SIZDAN</span><h2>Bilimingizga yangi hamroh.</h2></div><Link className="btn btn-warm" href="/mentors">Mentor topish <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
