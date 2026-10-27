'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Building2,Star} from 'lucide-react';
import {useI18n} from '@/components/i18n';
import {Avatar,Empty,Loading,Notice} from '@/components/common';
import {CenterLogo} from '@/components/center-logo';
import {api} from '@/lib/api';
import type {Leaderboard,RankStats} from '@/lib/leaderboard';
import './leaderboard.css';

export default function LeaderboardPage(){
  const {t}=useI18n();
  const [tab,setTab]=useState<keyof Leaderboard>('mentors');const [data,setData]=useState<Leaderboard|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setError('');api<Leaderboard>('leaderboard/').then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[retry]);
  return <div className="dashboard-page board-page">
    <header className="workspace-heading"><div><span className="eyebrow">{t('ENG YAXSHILAR')}</span><h1>{t('Reyting')}</h1><p>{t('O‘quvchilar to‘lovi tasdiqlangan darslardan keyin qo‘ygan baholar asosida.')}</p></div></header>
    <div className="role-switch">{([['mentors','Mentorlar'],['centers','O‘quv markazlari']] as const).map(([value,label])=><button key={value} type="button" className={tab===value?'active':''} aria-pressed={tab===value} onClick={()=>setTab(value)}>{t(label)}</button>)}</div>
    {error&&<Notice kind="error">{t(error)}<button onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>}
    {!data?!error&&<Loading/>:!data[tab].length?<Empty title={t('Reyting hali shakllanmagan')}><p>{t('O‘quvchilar darsdan keyin baho qoldirgach, eng yaxshilar shu yerda chiqadi.')}</p></Empty>:<ol className="board-list">
      {tab==='mentors'?data.mentors.map(m=><li key={m.id}><Link href={`/mentors/${m.id}`} className="board-row"><Rank n={m.rank}/><Avatar name={m.full_name} src={m.avatar} small/><span className="board-name"><strong>{m.full_name}</strong><small>{m.headline}{m.center&&` · ${m.center.name}`}</small></span><Score row={m}/></Link></li>)
      :data.centers.map(c=><li key={c.id}><Link href={`/centers/${c.id}`} className="board-row"><Rank n={c.rank}/><CenterLogo className="board-icon" name={c.name} logo={c.logo}><Building2 size={18}/></CenterLogo><span className="board-name"><strong>{c.name}</strong><small>{t(c.kind==='online'?'Onlayn markaz':'Offline markaz')}{c.city&&` · ${c.city}`} · {t(`${c.mentor_count} ta mentor`)}</small></span><Score row={c}/></Link></li>)}
    </ol>}
    <p className="board-note">{t('Baholari kam bo‘lganlar ehtiyotkorlik bilan hisoblanadi, shuning uchun bitta 5 yulduzli baho uzoq va barqaror natijadan ustun chiqmaydi.')}</p>
  </div>;
}

function Rank({n}:{n:number}){return <span className={`board-rank r${n}`}>{n}</span>;}

function Score({row}:{row:RankStats}){
  const {t}=useI18n();
  return <>
    <span className="board-stat board-lessons"><strong>{row.lessons_completed}</strong><small>{t('muvaffaqiyatli dars')}</small></span>
    <span className="board-stat board-rating"><strong><span className="sr-only">{t('O‘rtacha baho')}:</span><Star size={15} aria-hidden/>{row.rating_average.toFixed(1)}</strong><small>{t(`${row.rating_count} ta baho`)}</small></span>
  </>;
}
