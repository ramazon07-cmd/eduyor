'use client';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,BookOpen,LogOut,Menu,X,Sparkles} from 'lucide-react';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from './auth';
import {api,money} from '@/lib/api';
import type {Mentor,OwnMentorListing} from '@/lib/types';
import {Button} from './ui/button';
import {Card} from './ui/card';
import {MeetingNotice} from './meeting-notice';
export function Logo(){return <Link href="/" className="logo" aria-label="EduYor bosh sahifa"><span className="logo-mark"><Sparkles size={19}/></span>Edu<span>Yor</span><span className="logo-dot">.</span></Link>;}
export function Header(){
  const {user,loading,setUser,error} = useAuth();const router=useRouter();const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [logoutError,setLogoutError]=useState('');
  async function signOut(){setBusy(true);try{await api('auth/logout/',{method:'POST',body:'{}'});setUser(null);router.push('/');setOpen(false);}catch(e){setLogoutError((e as Error).message);}finally{setBusy(false);}}
  return <><header className="header"><div className="container header-inner"><Logo/><nav className="desktop-nav"><Link href="/mentors">Mentor topish</Link><Link href="/dashboard?tab=mentor">Mentor bo‘lish</Link>{user&&<Link href="/dashboard">Darslarim</Link>}</nav><div className="header-account">{loading?<span className="muted small">Yuklanmoqda…</span>:user?<><Link href="/profile" className="account-name"><Avatar name={user.profile.full_name} src={user.profile.avatar} small/>{user.profile.full_name.split(' ')[0]}</Link><Button variant="ghost" size="sm" onClick={signOut} disabled={busy} aria-label="Hisobdan chiqish"><LogOut size={17}/></Button></>:<><Link className="login-link" href="/login">Kirish</Link><Link className="btn btn-primary btn-sm" href="/register">Boshlash <ArrowUpRight size={16}/></Link></>}<button className="mobile-toggle" onClick={()=>setOpen(!open)} aria-label="Menyu" aria-expanded={open}>{open?<X/>:<Menu/>}</button></div></div>{open&&<nav className="mobile-nav"><Link onClick={()=>setOpen(false)} href="/mentors">Mentor topish</Link><Link onClick={()=>setOpen(false)} href="/dashboard">Darslarim / Mentor bo‘lish</Link><Link onClick={()=>setOpen(false)} href="/profile">Profilim</Link></nav>}</header>{(error||logoutError)&&<div className="container"><Notice kind="error">{error||logoutError}</Notice></div>}<MeetingNotice/></>;
}
export function Footer(){return <footer className="footer container"><Logo/><span>O‘rganing. Ulashing. Birga o‘sing.</span><Link href="/mentors">Mentor topish <ArrowUpRight size={14}/></Link></footer>;}
export function Avatar({name,src,small=false}:{name:string;src?:string|null;small?:boolean}) {const [failed,setFailed]=useState(false);return <span className={`avatar ${small?'avatar-sm':''}`}>{src&&!failed?<img src={src} onError={()=>setFailed(true)} alt={name}/>:name.replace('Demo · ','').split(' ').map(s=>s[0]).slice(0,2).join('')}</span>;}
export function Notice({children,kind='info'}:{children:React.ReactNode;kind?:'info'|'error'|'success'}) {return <div className={`notice notice-${kind}`} role={kind==='error'?'alert':'status'}>{children}</div>;}
export function Loading(){return <div className="loading" role="status"><span className="spinner"/>Yuklanmoqda…</div>;}
export function Empty({title,children}:{title:string;children?:React.ReactNode}){return <Card className="empty"><BookOpen size={30}/><h3>{title}</h3>{children}</Card>;}
export function LoginRequired({next="/dashboard"}:{next?:string}){return <div className="narrow section"><Empty title="Avval hisobingizga kiring"><p>Darslarni boshqarish va mentorlik qilish uchun.</p><Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">Kirish <ArrowRight size={16}/></Link></Empty></div>;}
export function MentorCard({mentor:m,own}:{mentor:Mentor;own?:OwnMentorListing}) {
  const label=own?(own.approval==='pending'?'Admin tekshiruvida':own.approval==='rejected'?'Rad etilgan':own.is_paused?'Pauzada':'Tasdiqlangan'):'';
  return <Card className={`mentor-card ${own?'own-mentor-card':''}`}><div className="mentor-top"><Avatar name={m.full_name} src={m.avatar}/><span className="tiny muted">{own?'Sizning e’loningiz':'Onlayn · 60 daqiqa'}</span></div><h3>{m.full_name}</h3><p className="mentor-headline">{m.headline}</p><div className="chips">{m.subjects.map(s=><span className="chip" key={s.id}>{s.name}</span>)}</div>{own&&<div className="own-listing-state"><span className={`status ${own.is_public?'status-confirmed':''}`}>{label}</span><p>{own.approval==='pending'?'Hozircha faqat siz ko‘rasiz. Boshqalarga chiqishi uchun admin tasdig‘i kerak.':own.approval==='rejected'?'Ma’lumotlarni yangilab, arizani qayta yuboring.':own.is_paused?'Pauzani o‘chirsangiz, tasdiqlangan profilingiz yana ro‘yxatga chiqadi.':'E’loningiz boshqalarga ko‘rinadi. O‘zingizdan dars band qila olmaysiz.'}</p></div>}<div className="mentor-bottom"><div><strong>{money(m.hourly_price)}</strong><span className="tiny muted"> / dars</span></div><Link href={own?'/dashboard?tab=mentor':`/mentors/${m.id}`} className="mentor-card-cta" aria-label={own?'Mentor e’lonimni tahrirlash':`${m.full_name} profilini ko‘rish`}>{own?'Tahrirlash':'Profilni ko‘rish'}<ArrowUpRight size={17}/></Link></div></Card>;
}
