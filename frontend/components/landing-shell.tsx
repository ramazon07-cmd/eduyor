'use client';

import Link from 'next/link';
import {useState,type ReactNode} from 'react';
import {ArrowUpRight,Menu,X} from 'lucide-react';
import {Logo,Notice} from './common';
import {useAuth} from './auth';

const navigation=[['/#qanday-ishlaydi','Qanday ishlaydi?'],['/#mentorlar','Mentorlar'],['/#mentor-bolish','Mentor bo‘lish'],['/#savollar','Savollar']];

export function LandingShell({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false);
  const {user,loading,error}=useAuth();
  return <div className="landing-site">
    <a className="skip-link" href="#page-content">Asosiy mazmunga o‘tish</a>
    <header className="landing-header">
      <div className="container landing-nav-row">
        <Logo/>
        <nav className="landing-desktop-nav" aria-label="Bosh sahifa menyusi">{navigation.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
        <div className="landing-account">
          {loading?<span className="small muted" role="status">Yuklanmoqda…</span>:user?<Link className="btn btn-primary" href="/dashboard/home">Kabinetga o‘tish <ArrowUpRight size={17}/></Link>:<><Link className="text-link landing-login" href="/login">Kirish</Link><Link className="btn btn-primary" href="/register">Boshlash <ArrowUpRight size={17}/></Link></>}
          <button className="landing-menu-button" type="button" aria-label={open?'Menyuni yopish':'Menyuni ochish'} aria-expanded={open} aria-controls="landing-mobile-nav" onClick={()=>setOpen(!open)}>{open?<X size={22}/>:<Menu size={22}/>}</button>
        </div>
      </div>
      {open&&<nav id="landing-mobile-nav" className="landing-mobile-nav container" aria-label="Mobil menyu" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>{navigation.map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)}>{label}<ArrowUpRight size={16}/></Link>)}{!user&&<Link href="/login" onClick={()=>setOpen(false)}>Hisobga kirish <ArrowUpRight size={16}/></Link>}</nav>}
    </header>
    {error&&<div className="container"><Notice kind="error">{error}</Notice></div>}
    <main id="page-content" className="landing-main">{children}</main>
    <footer className="container landing-footer"><div><Logo/><p>O‘rganing. Ulashing. Birga o‘sing.</p></div><nav aria-label="Pastki menyu"><Link href="/mentors">Mentor topish</Link><Link href="/dashboard?tab=mentor">Mentor bo‘lish</Link><Link href="/#savollar">Savollar va javoblar</Link></nav><span>© {new Date().getFullYear()} EduYor</span></footer>
  </div>;
}
