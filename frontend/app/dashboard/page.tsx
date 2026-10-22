'use client';
import {monthTitle,selectedDateLabel} from '@/lib/dates';
import Link from 'next/link';
import {Suspense,useEffect,useState,useMemo} from 'react';
import {useSearchParams} from 'next/navigation';
import {BookOpen,GraduationCap,CalendarDays,Wallet,ArrowUpRight,Video,ChevronLeft,ChevronRight,ArrowRight,Clock3} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {api,money,when,statusLabel} from '@/lib/api';
import type {Booking,Page,User} from '@/lib/types';
import {Loading,LoginRequired,Empty,Notice} from '@/components/common';
import {BrandMark} from '@/components/brand';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {MentorForm} from '@/components/mentor-settings';
const tabs=[{id:'lessons',label:'Darslarim',icon:BookOpen},{id:'mentor',label:'Mentor profilim',icon:GraduationCap},{id:'earnings',label:'Daromadim',icon:Wallet}];
function localDay(value:string,tz:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));return ['year','month','day'].map(type=>parts.find(p=>p.type===type)?.value).join('-');}
function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export default function DashboardPage(){return <Suspense fallback={<Loading/>}><Dashboard/></Suspense>;}
function Dashboard(){
  const {user,loading}=useAuth();const params=useSearchParams();
  const requested=params.get('tab');const tab=tabs.some(t=>t.id===requested)?requested!:'lessons';
  if(loading)return <Loading/>;if(!user)return <LoginRequired next={tab==='mentor'?'/dashboard?tab=mentor':'/dashboard'}/>;
  return <div className="dashboard-page">
    <header className="workspace-heading"><div><span className="eyebrow">{tab==='lessons'?'YANGI BILIMGA YANGI KUN':tab==='mentor'?'TAJRIBANGIZNI ULASHING':'MEHNATINGIZ NATIJASI'}</span><h1>{tab==='lessons'?`Salom, ${user.profile.full_name.split(' ')[0]}`:tab==='mentor'?'Mentor profilim':'Daromadim'}</h1><p>{tab==='lessons'?'O‘rganish va o‘rgatish — bir joyda.':tab==='mentor'?'Bilimingiz kimningdir keyingi qadami bo‘lsin.':'Yakunlangan darslar va mentor ulushingiz.'}</p></div></header>
      {tab==='lessons'?<Lessons user={user}/>:<div className="workspace-settings-grid"><div>{tab==='mentor'?<MentorForm/>:<Earnings/>}</div><aside className="workspace-rail"><BrandNote/></aside></div>}
  </div>;
}
function BrandNote(){return <Card className="brand-note"><BrandMark/><h3>Bilimga hamroh.</h3><p>Bitta profil orqali ham o‘rganing, ham o‘rgating.</p><span><Video size={15}/>Google Meet · 50 daqiqa</span></Card>;}
function Lessons({user}:{user:User}){
  const [data,setData]=useState<Page<Booking>|null>(null);const [page,setPage]=useState(1);const [role,setRole]=useState('');const [status,setStatus]=useState('');const [date,setDate]=useState('');const [retry,setRetry]=useState(0);const [error,setError]=useState('');const [busy,setBusy]=useState(true);
  const today=localDay(new Date().toISOString(),user.profile.timezone);
  const [month,setMonth]=useState(()=>{const [y,m]=today.split('-').map(Number);return new Date(y,m-1,1);});
  const query=useMemo(()=>new URLSearchParams({page:String(page),role,status,date}).toString(),[page,role,status,date]);
  useEffect(()=>{
    let active=true;
    async function load(quiet=false){if(!quiet){setBusy(true);setError('');}try{const result=await api<Page<Booking>>(`bookings/?${query}`);if(active)setData(result);}catch(e){if(active&&!quiet){setError((e as Error).message);setData(null);}}finally{if(active&&!quiet)setBusy(false);}}
    void load();const timer=setInterval(()=>{void load(true);},20000);
    return()=>{active=false;clearInterval(timer);};
  },[query,retry]);
  function pickDate(value:string){setPage(1);setDate(value===date?'':value);}
  function reset(){setDate('');setRole('');setStatus('');setPage(1);}
  const marked=new Set((data?.results||[]).map(b=>localDay(b.starts_at,user.profile.timezone)));
  return <div className="workspace-grid"><div className="workspace-content">
    <div className="welcome-banner"><div><span className="eyebrow">SIZGA MOS TAJRIBA</span><h2>Keyingi qadamingiz<br/>bir suhbat narida.</h2><Link href="/mentors">Mentorlarni ko‘rish <ArrowRight size={17}/></Link></div><BrandMark/></div>
    <div className="lesson-toolbar"><h2>Darslarim <span>{data?.count??'—'}</span></h2><select aria-label="Dars holati" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Barcha holatlar</option><option value="pending_payment">To‘lov kutilmoqda</option><option value="confirmed">Tasdiqlangan</option><option value="completed">Yakunlangan</option><option value="expired">Muddati tugagan</option><option value="cancelled">Bekor qilingan</option></select></div>
    <div className="role-switch" aria-label="Darsdagi rolingiz">{[['','Barchasi'],['learning','O‘rganaman'],['teaching','Dars beraman']].map(([value,label])=><button type="button" key={value} className={role===value?'active':''} onClick={()=>{setRole(value);setPage(1);}} aria-pressed={role===value}>{label}</button>)}</div>
    {date&&<div className="selected-date-note"><CalendarDays size={15}/>{selectedDateLabel(date)}<button type="button" onClick={()=>pickDate('')}>Sanani tozalash ×</button></div>}
    {error&&<Notice kind="error">{error}<button onClick={()=>setRetry(n=>n+1)}>Qayta urinish</button></Notice>}
    {busy?<div className="lesson-skeletons" aria-busy="true">{[1,2,3].map(n=><div className="skeleton" key={n}/>)}</div>:!error&&data&&!data.count?<Empty title={date?'Bu sanada dars yo‘q':role||status?'Mos dars topilmadi':'Birinchi darsingiz oldinda'}><p>{date||role||status?'Boshqa sana yoki filtrni tanlang.':'Maqsadingizga mos mentor bilan boshlang.'}</p>{date||role||status?<Button variant="outline" onClick={reset}>Filtrlarni tozalash</Button>:<Link href="/mentors" className="btn btn-primary">Mentor topish <ArrowUpRight size={16}/></Link>}</Empty>:!error&&<div className="lesson-feed">{data?.results.map(b=>{const teaching=b.mentor===user.id;return <Link key={b.id} href={`/sessions/${b.id}`} className={`lesson-tile ${teaching?'lesson-teaching':'lesson-learning'}`}><div className="lesson-art"><span>{teaching?<GraduationCap size={34}/>:<BookOpen size={32}/>}</span><i/><i/></div><div className="lesson-tile-copy"><div className="lesson-tile-top"><span className="role-label">{teaching?'DARS BERAMAN':'O‘RGANAMAN'}</span><span className={`status status-${b.status}`}>{statusLabel[b.status]}</span></div><h3>{teaching?b.student_name:b.mentor_name}</h3><p><CalendarDays size={14}/>{when(b.starts_at,user.profile.timezone)}</p><small><Clock3 size={13}/>{b.duration_minutes} daqiqa · {user.profile.timezone}</small>{b.status==='confirmed'&&<span className={`lesson-meet-hint ${b.meeting_url?'ready':''}`}><Video size={13}/>{b.meeting_url?'Google Meet tayyor':teaching?'Meet havolasini qo‘shing':'Havola kutilmoqda'}</span>}{b.disputed&&<span className="lesson-meet-hint">Admin ko‘rib chiqmoqda</span>}<div className="lesson-tile-footer"><strong>{money(b.total_price)}</strong><span>Darsni ochish <ArrowUpRight size={17}/></span></div></div></Link>;})}</div>}
    {data&&data.count>20&&<div className="pagination"><Button variant="outline" disabled={!data.previous||busy} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/>Oldingi</Button><span>{page} / {Math.ceil(data.count/20)}</span><Button variant="outline" disabled={!data.next||busy} onClick={()=>setPage(p=>p+1)}>Keyingi<ChevronRight size={16}/></Button></div>}
    </div><aside className="workspace-rail"><DashboardCalendar month={month} setMonth={setMonth} selected={date} select={pickDate} today={today} marked={marked}/><Card className="mentor-status-card"><span className="eyebrow">MENTORLIK</span><GraduationCap size={25}/><h3>{user.mentor?'Tajribangizni ulashing':'Siz ham mentor bo‘ling'}</h3><p>{user.mentor?user.mentor.approval==='pending'?'Arizangiz admin tekshiruvida.':user.mentor.is_paused?'E’loningiz hozir pauzada.':user.mentor.approval==='approved'?'Profilingiz tasdiqlangan.':'Arizangizni yangilab, qayta yuboring.':'Bilimingiz kimningdir maqsadiga yo‘l ochadi.'}</p><Link href="/dashboard?tab=mentor">{user.mentor?'Profilni boshqarish':'Boshlash'}<ArrowUpRight size={16}/></Link></Card><span className="rail-timezone"><Clock3 size={13}/>{user.profile.timezone}</span></aside></div>;
}
function DashboardCalendar({month,setMonth,selected,select,today,marked}:{month:Date;setMonth:(value:Date)=>void;selected:string;select:(value:string)=>void;today:string;marked:Set<string>}){
  const offset=(month.getDay()+6)%7;const total=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const cells=[...Array(offset).fill(null),...Array.from({length:total},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1))] as (Date|null)[];
  return <Card className="dashboard-calendar"><div className="month-bar"><strong>{monthTitle(month)}</strong><div><button type="button" aria-label="Oldingi oy" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={17}/></button><button type="button" aria-label="Keyingi oy" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={17}/></button></div></div><div className="dashboard-calendar-grid">{['Du','Se','Ch','Pa','Ju','Sh','Ya'].map(day=><span key={day}>{day}</span>)}{cells.map((day,i)=>day?<button type="button" key={dayKey(day)} aria-pressed={selected===dayKey(day)} className={`${selected===dayKey(day)?'selected':''} ${today===dayKey(day)?'today':''} ${marked.has(dayKey(day))?'has-lesson':''}`} onClick={()=>select(dayKey(day))}>{day.getDate()}</button>:<i key={`blank-${i}`}/>)}</div><p>Sanani tanlab darslarni ko‘ring.</p><small><span/>Ro‘yxatdagi dars sanalari</small></Card>;
}
function Earnings(){
  const [data,setData]=useState<Record<string,string>|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setError('');api<Record<string,string>>('earnings/').then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[retry]);
  return <>{error?<Notice kind="error">{error}<button onClick={()=>setRetry(n=>n+1)}>Qayta urinish</button></Notice>:!data?<Loading/>:<><Card className="earnings-intro"><Wallet size={25}/><div><h2>Mehnatingiz qiymati</h2><p>Faqat to‘lovi tekshirilgan, yakunlangan va nizosiz darslar hisoblanadi.</p></div></Card><div className="earnings-grid">{[['gross','Darslar qiymati'],['platform_fee','Platforma ulushi'],['net_earned','Sof daromad'],['pending_payout','O‘tkazilishi kutilmoqda'],['paid','To‘langan']].map(([key,label])=><Card key={key} className={`earning-card ${key==='net_earned'?'earning-highlight':''}`}><p>{label}</p><strong>{money(data[key])}</strong></Card>)}</div><Notice>Dars yakuni tasdiqlangach, mentor ulushi admin tomonidan qo‘lda o‘tkaziladi.</Notice></>}</>;
}
