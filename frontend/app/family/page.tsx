'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {BookOpen,CalendarDays,ClipboardCheck,KeyRound,RefreshCw,UserPlus} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {useI18n} from '@/components/i18n';
import {Avatar,Empty,Loading,LoginRequired,Notice} from '@/components/common';
import {InviteCode} from '@/components/invite-code';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {api,money,statusLabel,when} from '@/lib/api';
import {taskState} from '@/lib/learning';
import type {ChildLesson,ChildProgress,Family,FamilyInvite} from '@/lib/family';
import './family.css';

export default function FamilyPage(){
  const {user,loading}=useAuth();const {t}=useI18n();
  const [family,setFamily]=useState<Family|null>(null);const [selected,setSelected]=useState<number|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  const parent=user?.profile.account_type==='parent';
  useEffect(()=>{
    if(!parent)return;
    let active=true;setError('');
    api<Family>('family/').then(data=>{if(active){setFamily(data);setSelected(id=>data.children.some(c=>c.id===id)?id:data.children[0]?.id??null);}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[parent,retry]);
  if(loading)return <Loading/>;if(!user)return <LoginRequired next="/family"/>;
  if(!parent)return <div className="narrow section"><Empty title={t('Bu bo‘lim ota-onalar uchun')}><p>{t('Ota-onangiz natijalaringizni ko‘rishi uchun ular bergan kodni Profilim sahifasiga kiriting.')}</p><Link className="btn btn-primary" href="/profile#parent-access">{t('Profilimga o‘tish')}</Link></Empty></div>;
  const children=family?.children||[];const current=children.find(c=>c.id===selected);
  const refresh=()=>setRetry(n=>n+1);
  return <div className="dashboard-page family-page">
    <header className="workspace-heading"><div><span className="eyebrow">{t('OTA-ONA KABINETI')}</span><h1>{t('Farzandlarim')}</h1><p>{t('Farzandingizning darslari, vazifalari va natijalari bir joyda.')}</p></div></header>
    {error&&<Notice kind="error">{t(error)}<button onClick={refresh}>{t('Qayta urinish')}</button></Notice>}
    {!family?!error&&<Loading/>:<>
      {children.length>1&&<div className="role-switch" aria-label={t('Farzandni tanlang')}>{children.map(c=><button type="button" key={c.id} className={selected===c.id?'active':''} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}>{c.full_name}</button>)}</div>}
      {current&&<ChildOverview key={current.id} id={current.id} link={current.link} timezone={user.profile.timezone} onUnlinked={refresh}/>}
      <InviteCard invite={family.invite} first={!children.length} onCreated={invite=>setFamily(f=>f&&{...f,invite})} onRefresh={refresh}/>
    </>}
  </div>;
}

function ChildOverview({id,link,timezone,onUnlinked}:{id:number;link:number;timezone:string;onUnlinked:()=>void}){
  const {t,locale}=useI18n();
  const [data,setData]=useState<ChildProgress|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;setError('');api<ChildProgress>(`family/children/${id}/`).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,retry]);
  async function unlink(){if(!window.confirm(t('Farzandingiz bilan ulanish uzilsinmi? Qayta ulash uchun yangi kod kerak bo‘ladi.')))return;setBusy(true);setError('');try{await api(`family/links/${link}/`,{method:'DELETE'});onUnlinked();}catch(e){setError((e as Error).message);setBusy(false);}}
  if(error)return <Notice kind="error">{t(error)}<button onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>;
  if(!data)return <div className="skeleton family-skeleton" role="status" aria-label={t('Natijalar yuklanmoqda')}/>;
  const {child,lessons,tasks}=data;
  return <>
    <Card className="family-child"><Avatar name={child.full_name} src={child.avatar}/><div><h2>{child.full_name}</h2>{child.study_level&&<p>{child.study_level}</p>}</div>{child.learning_goals&&<blockquote><span className="eyebrow">{t('O‘RGANISH MAQSADI')}</span>{child.learning_goals}</blockquote>}</Card>
    <div className="student-stats">{[[lessons.completed,'Yakunlangan darslar'],[lessons.upcoming,'Rejalashtirilgan darslar'],[`${tasks.submitted} / ${tasks.total}`,'Topshirilgan vazifalar'],[tasks.reviewed,'Tekshirilgan vazifalar']].map(([value,label])=><div key={label}><span>{t(label)}</span><strong>{value}</strong></div>)}</div>
    {lessons.awaiting_payment>0&&<Notice>{t(`${lessons.awaiting_payment} ta dars to‘lovni kutmoqda. To‘lov farzandingiz hisobidagi dars sahifasida tasdiqlanadi.`)}</Notice>}
    <div className="family-grid"><LessonList title="Yaqin darslar" empty="Rejalashtirilgan dars yo‘q." rows={data.upcoming} timezone={timezone}/><LessonList title="So‘nggi darslar" empty="Hali yakunlangan dars yo‘q." rows={data.recent} timezone={timezone}/></div>
    <Card className="family-list"><h3>{t('Vazifa va testlar')}</h3>{data.assignments.length?data.assignments.map(task=><div className="family-row" key={task.id}>
      <span className={`family-row-icon ${task.kind}`}>{task.kind==='test'?<ClipboardCheck size={20}/>:<BookOpen size={20}/>}</span>
      <span className="family-row-copy"><small>{t(task.kind==='test'?'Test':'Uy vazifasi')} · {task.mentor_name}</small><strong>{task.title}</strong><small>{t('Muddat')}: {when(task.deadline,timezone,locale)}</small>{task.submission?.feedback&&<p className="family-feedback"><b>{t('Mentor izohi')}:</b> {task.submission.feedback}</p>}</span>
      <span className="family-row-meta"><span className={`family-task-status ${task.submission?.reviewed_at?'done':''}`}>{t(taskState(task))}</span>{task.submission?.correct_answers!=null&&<small>{t(`${task.submission.correct_answers} / ${task.question_count} to‘g‘ri`)}</small>}</span>
    </div>):<p className="muted">{t('Mentor topshiriq berganida shu yerda ko‘rinadi.')}</p>}</Card>
    <div className="family-actions"><Button variant="ghost" size="sm" disabled={busy} onClick={unlink}>{t('Ulanishni uzish')}</Button></div>
  </>;
}

function LessonList({title,empty,rows,timezone}:{title:string;empty:string;rows:ChildLesson[];timezone:string}){
  const {t,locale}=useI18n();
  return <Card className="family-list"><h3>{t(title)}</h3>{rows.length?rows.map(b=><div className="family-row" key={b.id}><span className="family-row-icon"><CalendarDays size={20}/></span><span className="family-row-copy"><strong>{b.mentor_name}</strong><small>{when(b.starts_at,timezone,locale)}</small>{b.objective&&<small className="family-objective">{b.objective}</small>}</span><span className="family-row-meta"><span className={`status status-${b.status}`}>{t(statusLabel[b.status])}</span>{b.status==='pending_payment'&&<small>{money(b.total_price)}</small>}</span></div>):<p className="muted">{t(empty)}</p>}</Card>;
}

function InviteCard({invite,first,onCreated,onRefresh}:{invite:FamilyInvite|null;first:boolean;onCreated:(invite:FamilyInvite)=>void;onRefresh:()=>void}){
  const {t}=useI18n();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function create(){setBusy(true);setError('');try{onCreated(await api<FamilyInvite>('family/invite/',{method:'POST',body:'{}'}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Card className={`family-invite ${first?'first':''}`}>
    <span className="eyebrow"><KeyRound size={15}/>{t(first?'BIRINCHI QADAM':'YANA FARZAND QO‘SHISH')}</span>
    <h2>{t(first?'Farzandingiz hisobini ulang':'Boshqa farzandingizni ulang')}</h2>
    <ol className="family-steps"><li>{t('Ulash kodini oling.')}</li><li>{t('Farzandingiz EduYor’dagi o‘z hisobiga kirsin. Hisobi bo‘lmasa, «O‘zim uchun» tanlab ro‘yxatdan o‘tsin.')}</li><li>{t('Farzandingiz Profilim sahifasidagi «Ota-ona bilan ulash» bo‘limiga kodni kiritsin.')}</li></ol>
    {error&&<Notice kind="error">{t(error)}</Notice>}
    {invite?<InviteCode code={invite.code}><Button type="button" variant="ghost" size="sm" onClick={onRefresh}><RefreshCw size={15}/>{t('Ulanganini tekshirish')}</Button></InviteCode>:<Button type="button" onClick={create} disabled={busy}><UserPlus size={17}/>{t(busy?'Kutilmoqda…':'Ulash kodini olish')}</Button>}
    <small>{t('Kod bir marta ishlaydi. Farzandingiz uni kiritgach, shu sahifada ko‘rinadi.')}</small>
  </Card>;
}
