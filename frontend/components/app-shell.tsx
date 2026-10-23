'use client';
import {useI18n} from '@/components/i18n';
import Link from 'next/link';
import {LanguageSwitcher} from './language-switcher';
import {usePathname,useSearchParams,useRouter} from 'next/navigation';
import {Suspense,useEffect,useState,useRef,type ReactNode} from 'react';
import {BookOpen,GraduationCap,Wallet,Search,House,Settings2,LogOut,Menu,X,ArrowUpRight,Clock3,MessageSquare,PanelLeftClose,PanelLeftOpen} from 'lucide-react';
import {useAuth} from './auth';
import {Logo,Avatar,Notice} from './common';
import {MeetingNotice} from './meeting-notice';
import {Button} from './ui/button';
import {api} from '@/lib/api';
import {LandingShell} from './landing-shell';

const links=[
  {href:'/dashboard/home',label:'Bosh sahifa',icon:House,key:'home'},
  {href:'/dashboard',label:'Darslarim',icon:BookOpen,key:'lessons'},
  {href:'/dashboard?tab=mentor',label:'Mentor profilim',icon:GraduationCap,key:'mentor'},
  {href:'/dashboard?tab=earnings',label:'Daromadim',icon:Wallet,key:'earnings'},
  {href:'/requests',label:'EduYor Request',icon:MessageSquare,key:'requests'},
  {href:'/mentors',label:'Mentor topish',icon:Search,key:'directory'},
];
function Navigation({close,collapsed}:{close:()=>void;collapsed:boolean}){
  const {t:translate}=useI18n();
  const path=usePathname().replace(/\/+$/, '')||'/';const params=useSearchParams();
  const active=(path==='/'||path==='/dashboard/home')?'home':path.startsWith('/mentors')?'directory':path.startsWith('/requests')?'requests':path.startsWith('/dashboard')?(['mentor','earnings'].includes(params.get('tab')||'')?params.get('tab'):'lessons'):path.startsWith('/sessions')?'lessons':'';
  return <nav aria-label={translate("Asosiy menyu")}>{links.map(item=><Link key={item.key} href={item.href} className={active===item.key?'active':''} aria-current={active===item.key?'page':undefined} onClick={close} aria-label={translate(item.label)} title={collapsed?translate(item.label):undefined}><item.icon size={19} aria-hidden="true"/><span className="app-nav-label">{translate(item.label)}</span>{active===item.key&&<span className="nav-active-dot"/>}</Link>)}</nav>;
}
function sectionName(path:string){if(path.startsWith('/requests'))return 'EduYor Request';if(path==='/dashboard/home')return 'Bosh sahifa';if(path==='/')return 'Bilimga hamroh';if(path.startsWith('/mentors/'))return 'Mentor bilan dars';if(path==='/mentors')return 'Mentorlar';if(path.startsWith('/sessions/'))return 'Dars tafsilotlari';if(path==='/profile')return 'Profilim';if(path==='/login')return 'Kirish';if(path==='/register')return 'Ro‘yxatdan o‘tish';return 'Shaxsiy kabinet';}

export function AppShell({children}:{children:ReactNode}){
  const {t:translate}=useI18n();
  const {user,loading,error,setUser}=useAuth();const path=usePathname().replace(/\/+$/, '')||'/';const router=useRouter();
  const [open,setOpen]=useState(false);const [collapsed,setCollapsed]=useState(false);const mobileToggle=useRef<HTMLButtonElement>(null);const [busy,setBusy]=useState(false);const [logoutError,setLogoutError]=useState('');
  useEffect(()=>setOpen(false),[path]);
  useEffect(()=>{
    if(!open)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);mobileToggle.current?.focus();}};
    window.addEventListener('keydown',escape);
    return()=>window.removeEventListener('keydown',escape);
  },[open]);
  async function signOut(){setBusy(true);setLogoutError('');try{await api('auth/logout/',{method:'POST',body:'{}'});setUser(null);router.push('/');setOpen(false);}catch(e){setLogoutError((e as Error).message);}finally{setBusy(false);}}
  if(path==='/')return <LandingShell>{children}</LandingShell>;
  return <><a href="#page-content" className="skip-link">{translate("Asosiy mazmunga o‘tish")}</a><div className={`workspace-shell app-shell ${collapsed?'sidebar-collapsed':''}`}>
    <aside id="app-sidebar" className={`workspace-sidebar app-sidebar ${open?'menu-open':''}`}><div className="app-sidebar-brand"><Logo href="/dashboard/home"/><button type="button" className="app-menu-toggle" ref={mobileToggle} aria-label={translate(open?'Menyuni yopish':'Menyuni ochish')} aria-expanded={open} aria-controls="app-navigation" onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button></div><div id="app-navigation"><Suspense fallback={<nav aria-label={translate("Menyu yuklanmoqda")}><Link href="/mentors"><Search size={19}/>{translate("Mentor topish")}</Link></nav>}><Navigation close={()=>setOpen(false)} collapsed={collapsed}/></Suspense></div>
      <Link className="sidebar-account" aria-label={`${user?.profile.full_name||translate('Xush kelibsiz')} · ${translate(user?'Profil sozlamalari':'Hisobingizga kiring')}`} title={collapsed?translate(user?'Profil sozlamalari':'Hisobingizga kiring'):undefined} href={user?'/profile':'/login'} onClick={()=>setOpen(false)}><Avatar name={user?.profile.full_name||'EduYor'} src={user?.profile.avatar} small/><span><strong>{user?.profile.full_name.split(' ')[0]||translate('Xush kelibsiz')}</strong><small>{translate(user?'Profil sozlamalari':'Hisobingizga kiring')}</small></span><Settings2 size={16}/></Link>
    </aside>
    <div className="workspace-body app-body"><header className="app-topbar"><div className="app-topbar-leading"><button type="button" className="app-sidebar-toggle" onClick={()=>setCollapsed(value=>!value)} aria-label={translate(collapsed?'Yon menyuni kengaytirish':'Yon menyuni ixchamlash')} title={translate(collapsed?'Yon menyuni kengaytirish':'Yon menyuni ixchamlash')} aria-expanded={!collapsed} aria-controls="app-sidebar">{collapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button><Link href="/dashboard/home" className="app-breadcrumb">{translate("EduYor")}<span>/</span><strong>{translate(sectionName(path))}</strong></Link></div><div className="app-topbar-actions"><LanguageSwitcher/><span className="app-duration"><Clock3 size={14}/>{translate("50 daqiqa")}</span>{loading?<span className="small muted">{translate("Yuklanmoqda…")}</span>:user?<><Link href="/profile" className="app-user"><Avatar name={user.profile.full_name} src={user.profile.avatar} small/><span>{user.profile.full_name.split(' ')[0]}</span></Link><Button size="sm" variant="ghost" aria-label={translate("Hisobdan chiqish")} onClick={signOut} disabled={busy}><LogOut size={17}/></Button></>:<><Link className="text-link" href="/login">{translate("Kirish")}</Link><Link className="btn btn-primary btn-sm" href="/register">{translate("Boshlash")} <ArrowUpRight size={15}/></Link></>}</div></header>
      {(error||logoutError)&&<Notice kind="error">{error||logoutError}</Notice>}
      <main id="page-content" className="app-main">{children}</main>
      <footer className="app-footer"><span>{translate("O‘rganing. Ulashing. Birga o‘sing.")}</span></footer>
    </div>
  </div><MeetingNotice/></>;
}
