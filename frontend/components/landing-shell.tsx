'use client';
import {useI18n} from '@/components/i18n';

import Link from 'next/link';
import {LanguageSwitcher} from './language-switcher';
import {useState,type ReactNode} from 'react';
import {ArrowUpRight,Menu,X} from 'lucide-react';
import {Logo,Notice} from './common';
import {useAuth} from './auth';

const navigation=[['/#mentorlar','Mentorlar'],['/#markazlar','O‘quv markazlari'],['/#qanday-ishlaydi','Qanday ishlaydi?'],['/#savollar','Savollar']];

export function LandingShell({children}:{children:ReactNode}){
  const {t:translate}=useI18n();
  const [open,setOpen]=useState(false);
  const {user,loading,error}=useAuth();
  return <div className="landing-site">
    <a className="skip-link" href="#page-content">{translate("Asosiy mazmunga o‘tish")}</a>
    <header className="landing-header">
      <div className="container landing-nav-row">
        <Logo/>
        <nav className="landing-desktop-nav" aria-label={translate("Bosh sahifa menyusi")}>{navigation.map(([href,label])=><Link key={href} href={href}>{translate(label)}</Link>)}</nav>
        <div className="landing-account"><LanguageSwitcher/>
          {loading?<span className="account-skeleton skeleton" role="status"><span className="sr-only">{translate("Yuklanmoqda…")}</span></span>:user?<Link className="btn btn-primary" href="/dashboard/home">{translate("Kabinetga o‘tish")} <ArrowUpRight size={17}/></Link>:<><Link className="text-link landing-login" href="/login">{translate("Kirish")}</Link><Link className="btn btn-primary" href="/register">{translate("Boshlash")} <ArrowUpRight size={17}/></Link></>}
          <button className="landing-menu-button" type="button" aria-label={translate(open?'Menyuni yopish':'Menyuni ochish')} aria-expanded={open} aria-controls="landing-mobile-nav" onClick={()=>setOpen(!open)}>{open?<X size={22}/>:<Menu size={22}/>}</button>
        </div>
      </div>
      {open&&<nav id="landing-mobile-nav" className="landing-mobile-nav container" aria-label={translate("Mobil menyu")} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>{navigation.map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)}>{translate(label)}<ArrowUpRight size={16}/></Link>)}{!user&&<><Link href="/login" onClick={()=>setOpen(false)}>{translate("Hisobga kirish")} <ArrowUpRight size={16}/></Link><Link href="/register" onClick={()=>setOpen(false)}>{translate("Boshlash")} <ArrowUpRight size={16}/></Link></>}</nav>}
    </header>
    {error&&<div className="container"><Notice kind="error">{translate(error)}</Notice></div>}
    <main id="page-content" className="landing-main">{children}</main>
    <footer className="container landing-footer"><div><Logo/></div><nav aria-label={translate("Pastki menyu")}><Link href="/#mentorlar">{translate("Mentorlar")}</Link><Link href="/#markazlar">{translate("O‘quv markazlari")}</Link><Link href="/#savollar">{translate("Savollar va javoblar")}</Link></nav><span>© {new Date().getFullYear()} {translate("EduYor")}</span></footer>
  </div>;
}
