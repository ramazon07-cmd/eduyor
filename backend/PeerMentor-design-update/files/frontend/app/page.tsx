'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,CalendarDays,Check,Clock3,GraduationCap,ShieldCheck,Sparkles,Video,Wallet} from 'lucide-react';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice} from '@/components/common';

export default function Home(){
  const [mentors,setMentors]=useState<Mentor[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    api<Page<Mentor>>('mentors/').then(d=>setMentors(d.results.slice(0,3))).catch(()=>setError('Mentorlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.')).finally(()=>setLoaded(true));
    api<Subject[]>('subjects/').then(setSubjects).catch(()=>{});
  },[]);
  return <>
    <section className="launch-hero">
      <div className="hero-shapes" aria-hidden="true"><span/><span/><span/><span/></div>
      <div className="launch-copy">
        <span className="launch-tag"><Sparkles size={15}/>Tengdoshlardan o‘rganing</span>
        <h1>Katta maqsadlar.<br/>Birga osonroq.</h1>
        <p>Sizga kerakli tajriba — bir suhbat narida.<br/>Mentor toping, vaqt tanlang va birga o‘sing.</p>
        <div className="launch-actions"><Link className="btn hero-primary" href="/mentors">Mentor topish <ArrowUpRight size={19}/></Link><Link className="hero-secondary" href="/dashboard?tab=mentor">Mentor bo‘lish <ArrowRight size={17}/></Link></div>
        <div className="launch-facts"><span><Clock3 size={16}/>60 daqiqa</span><span><Video size={16}/>Google Meet</span><span>30 000–60 000 so‘m</span></div>
      </div>
      <div className="product-window">
        <div className="window-bar"><div aria-hidden="true"><i/><i/><i/></div><span><ShieldCheck size={13}/>PeerMentor · o‘rganish maydoni</span><Sparkles size={15}/></div>
        <div className="product-inner">
          <div className="product-side"><span className="product-brand"><Sparkles size={22}/>Birga o‘sing.</span><span className="product-nav-active"><BookOpen size={17}/>O‘rganing</span><span><GraduationCap size={17}/>O‘rgating</span><div className="product-side-note">Bitta profil.<br/>Ikki imkoniyat.<ArrowUpRight size={28}/></div></div>
          <div className="product-main"><div className="product-welcome"><div><span className="eyebrow">SIZNING KEYINGI QADAMINGIZ</span><h2>Bugun nimani o‘rganamiz?</h2></div><span className="welcome-spark" aria-hidden="true">✳</span></div><div className="path-cards">{[[BookOpen,'01','Mentor toping','Maqsadingizga mos tajriba.'],[CalendarDays,'02','Vaqt tanlang','O‘zingizga qulay sanada.'],[Video,'03','Birga o‘rganing','Yakkama-yakka, onlayn.']].map(([Icon,n,title,description])=>{const StepIcon=Icon as typeof BookOpen;return <div className="path-card" key={String(n)}><div><StepIcon size={23}/><span>{String(n)}</span></div><h3>{String(title)}</h3><p>{String(description)}</p></div>;})}</div><Link className="product-bottom" href="/mentors"><span><Check size={17}/>Yangi bilimga bir qadam</span><span>Mentorlarni ko‘rish <ArrowRight size={17}/></span></Link></div>
        </div>
      </div>
    </section>
    <section className="container discovery-section"><div className="subject-pills"><span>Qaysi yo‘nalish sizniki?</span>{subjects.map(s=><Link key={s.id} href={`/mentors?subject=${s.id}`}>{s.name}<ArrowUpRight size={14}/></Link>)}</div><div className="section-heading"><div><span className="eyebrow">TAJRIBADAN O‘RGANING</span><h2>Keyingi mentoringiz shu yerda.</h2></div><Link className="text-link" href="/mentors">Barcha mentorlar <ArrowRight size={18}/></Link></div>{error&&<Notice kind="error">{error} <Link href="/mentors">Ro‘yxatni ochish</Link></Notice>}<div className="mentor-grid">{mentors.map(m=><MentorCard key={m.id} mentor={m}/>)}{!loaded&&[1,2,3].map(n=><div className="card skeleton" key={n} aria-label="Mentor yuklanmoqda"/>)}</div>{loaded&&!mentors.length&&!error&&<div className="card empty"><GraduationCap size={32}/><h3>Birinchi mentor bo‘ling</h3><p>Bilimingizni ulashishdan boshlang.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Mentorlikka ariza <ArrowUpRight size={17}/></Link></div>}</section>
    <section className="container learn-teach"><div className="learn-teach-copy"><span className="eyebrow">BILIM ULASHGANDA KO‘PAYADI</span><h2>Bir fandan o‘rganing.<br/>Boshqasidan o‘rgating.</h2><p>Mentor bo‘lish uchun yangi akkaunt ochish shart emas. Tajribangizni qo‘shing, tasdiqdan o‘ting va bilim ulashing.</p><Link className="btn btn-primary" href="/dashboard?tab=mentor">Men ham mentor bo‘laman <ArrowUpRight size={18}/></Link></div><div className="teach-note"><span className="teach-symbol" aria-hidden="true">✳</span><GraduationCap size={32}/><h3>Sizning bilimingiz.<br/>Kimningdir keyingi qadami.</h3><div><Wallet size={20}/><p>Har bir yangi darsdan<strong>80% sizga · 20% platformaga</strong></p></div></div></section>
    <section className="container faq-section"><div><span className="eyebrow">HAMMASI TUSHUNARLI</span><h2>Savollaringiz bormi?</h2><p>Boshlash uchun kerakli javoblar.</p></div><div className="faq-list">{[['Dars qanday o‘tadi?','Dars 60 daqiqa davom etadi. Mentor Google Meet havolasini dars sahifasiga qo‘shadi; to‘lov tasdiqlangach uni ko‘rasiz.'],['To‘lov qanday tasdiqlanadi?','Bron qilgach platforma rekvizitlariga to‘lov yuborasiz va tranzaksiya raqamini kiritasiz. Admin tushumni tekshirib, darsni tasdiqlaydi. Bron 60 daqiqa saqlanadi.'],['Mentor ham, o‘quvchi ham bo‘la olamanmi?','Ha. Bitta akkaunt orqali boshqalardan o‘rganasiz va o‘zingiz mentorlik qilasiz. O‘zingizdan dars band qila olmaysiz.'],['Dars narxi qancha?','Mentor yangi dars narxini 30 000–60 000 so‘m oralig‘ida belgilaydi. Student ko‘rsatilgan narxni to‘laydi, ustiga platforma to‘lovi qo‘shilmaydi.']].map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="container"><div className="closing-banner"><Sparkles size={30}/><h2>Keyingi qadamingizni<br/>bugun boshlang.</h2><Link className="btn hero-primary" href="/mentors">Mentor topish <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
