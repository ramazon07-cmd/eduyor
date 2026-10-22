'use client';
import Link from 'next/link';
import {usePathname,useSearchParams,useRouter} from 'next/navigation';
import {Suspense,useEffect,useState,type ReactNode} from 'react';
import {BookOpen,GraduationCap,Wallet,Search,House,Settings2,LogOut,Menu,X,ArrowUpRight,Clock3} from 'lucide-react';
import {useAuth} from './auth';
import {Logo,Avatar,Notice} from './common';
import {BrandMark} from './brand';
import {MeetingNotice} from './meeting-notice';
import {Button} from './ui/button';
import {api} from '@/lib/api';
import {LandingShell} from './landing-shell';

const links=[
  {href:'/dashboard/home',label:'Bosh sahifa',icon:House,key:'home'},
  {href:'/dashboard',label:'Darslarim',icon:BookOpen,key:'lessons'},
  {href:'/dashboard?tab=mentor',label:'Mentor profilim',icon:GraduationCap,key:'mentor'},
  {href:'/dashboard?tab=earnings',label:'Daromadim',icon:Wallet,key:'earnings'},
  {href:'/mentors',label:'Mentor topish',icon:Search,key:'directory'},
];
function Navigation({close}:{close:()=>void}){
  const path=usePathname().replace(/\/+$/, '')||'/';const params=useSearchParams();
  const active=(path==='/'||path==='/dashboard/home')?'home':path.startsWith('/mentors')?'directory':path.startsWith('/dashboard')?(['mentor','earnings'].includes(params.get('tab')||'')?params.get('tab'):'lessons'):path.startsWith('/sessions')?'lessons':'';
  return <nav aria-label="Asosiy menyu">{links.map(item=><Link key={item.key} href={item.href} className={active===item.key?'active':''} aria-current={active===item.key?'page':undefined} onClick={close}><item.icon size={19}/>{item.label}{active===item.key&&<span className="nav-active-dot"/>}</Link>)}</nav>;
}
function sectionName(path:string){if(path==='/dashboard/home')return 'Bosh sahifa';if(path==='/')return 'Bilimga hamroh';if(path.startsWith('/mentors/'))return 'Mentor bilan dars';if(path==='/mentors')return 'Mentorlar';if(path.startsWith('/sessions/'))return 'Dars tafsilotlari';if(path==='/profile')return 'Profilim';if(path==='/login')return 'Kirish';if(path==='/register')return 'Ro‘yxatdan o‘tish';return 'Shaxsiy kabinet';}

export function AppShell({children}:{children:ReactNode}){
  const {user,loading,error,setUser}=useAuth();const path=usePathname().replace(/\/+$/, '')||'/';const router=useRouter();
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [logoutError,setLogoutError]=useState('');
  useEffect(()=>setOpen(false),[path]);
  async function signOut(){setBusy(true);setLogoutError('');try{await api('auth/logout/',{method:'POST',body:'{}'});setUser(null);router.push('/');setOpen(false);}catch(e){setLogoutError((e as Error).message);}finally{setBusy(false);}}
  if(path==='/')return <LandingShell>{children}</LandingShell>;
  return <><a href="#page-content" className="skip-link">Asosiy mazmunga o‘tish</a><div className="workspace-shell app-shell">
    <aside className={`workspace-sidebar app-sidebar ${open?'menu-open':''}`}><div className="app-sidebar-brand"><Logo href="/dashboard/home"/><button type="button" className="app-menu-toggle" aria-label={open?'Menyuni yopish':'Menyuni ochish'} aria-expanded={open} aria-controls="app-navigation" onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button></div><span className="sidebar-caption">SIZNING MAYDONINGIZ</span><div id="app-navigation"><Suspense fallback={<nav aria-label="Menyu yuklanmoqda"><Link href="/mentors"><Search size={19}/>Mentor topish</Link></nav>}><Navigation close={()=>setOpen(false)}/></Suspense></div>
      <div className="sidebar-note"><BrandMark/><strong>Birga balandroq.</strong><p>O‘rganing va bilimingizni ulashing.</p></div>
      <Link className="sidebar-account" href={user?'/profile':'/login'} onClick={()=>setOpen(false)}><Avatar name={user?.profile.full_name||'EduYor'} src={user?.profile.avatar} small/><span><strong>{user?.profile.full_name.split(' ')[0]||'Xush kelibsiz'}</strong><small>{user?'Profil sozlamalari':'Hisobingizga kiring'}</small></span><Settings2 size={16}/></Link>
    </aside>
    <div className="workspace-body app-body"><header className="app-topbar"><Link href="/dashboard/home" className="app-breadcrumb">EduYor<span>/</span><strong>{sectionName(path)}</strong></Link><div className="app-topbar-actions"><span className="app-duration"><Clock3 size={14}/>50 daqiqa</span>{loading?<span className="small muted">Yuklanmoqda…</span>:user?<><Link href="/profile" className="app-user"><Avatar name={user.profile.full_name} src={user.profile.avatar} small/><span>{user.profile.full_name.split(' ')[0]}</span></Link><Button size="sm" variant="ghost" aria-label="Hisobdan chiqish" onClick={signOut} disabled={busy}><LogOut size={17}/></Button></>:<><Link className="text-link" href="/login">Kirish</Link><Link className="btn btn-primary btn-sm" href="/register">Boshlash <ArrowUpRight size={15}/></Link></>}</div></header>
      {(error||logoutError)&&<Notice kind="error">{error||logoutError}</Notice>}
      <main id="page-content" className="app-main">{children}</main>
      <footer className="app-footer"><span>O‘rganing. Ulashing. Birga o‘sing.</span><Link href="/mentors">Mentor topish <ArrowUpRight size={14}/></Link></footer>
    </div>
  </div><MeetingNotice/></>;
}
