'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Globe,MapPin,Users} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {useI18n} from '@/components/i18n';
import {Empty,Loading,Notice} from '@/components/common';
import {CenterLogo} from '@/components/center-logo';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/api';
import type {Center} from '@/lib/centers';
import type {Page} from '@/lib/types';
import './centers.css';

export default function CentersPage(){
  const {user}=useAuth();const {t}=useI18n();
  const [data,setData]=useState<Page<Center>|null>(null);const [page,setPage]=useState(1);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setError('');api<Page<Center>>(`centers/?page=${page}`).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[page,retry]);
  const parent=user?.profile.account_type==='parent';
  return <div className="dashboard-page centers-page">
    <header className="workspace-heading"><div><span className="eyebrow">{t('BIRGA KUCHLIROQ')}</span><h1>{t('O‘quv markazlari')}</h1><p>{t('Mentorlar jamoalari va hamkor o‘quv markazlari. Dars har doim tanlangan mentor bilan band qilinadi.')}</p></div>{!parent&&<Link className="btn btn-primary" href={user?'/centers/manage':'/login?next=/centers/manage'}>{t(user?'Markazim':'Markaz ochish')} <ArrowUpRight size={17}/></Link>}</header>
    {error&&<Notice kind="error">{t(error)}<button onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>}
    {!data?!error&&<Loading/>:!data.results.length?<Empty title={t('Hozircha tasdiqlangan markaz yo‘q')}><p>{t('Mentorlar birlashib yoki mavjud o‘quv markazi sifatida birinchi bo‘ling.')}</p></Empty>:<div className="center-grid">{data.results.map(c=><Link key={c.id} href={`/centers/${c.id}`} className="card center-card">
      <div className="center-card-identity"><CenterLogo className="center-card-mark" name={c.name} logo={c.logo}/><div><small>{t('O‘quv markazi')}</small><span className={`center-kind ${c.kind}`}>{c.kind==='online'?<Globe size={14}/>:<MapPin size={14}/>}{t(c.kind==='online'?'Onlayn markaz':'Offline markaz')}{c.city&&` · ${c.city}`}</span></div></div>
      <h2>{c.name}</h2><p>{c.description}</p>
      <span className="center-card-foot"><Users size={16}/>{t(`${c.mentor_count} ta mentor`)}<ArrowUpRight size={17}/></span>
    </Link>)}</div>}
    {data&&data.count>12&&<div className="pagination"><Button variant="outline" disabled={!data.previous} onClick={()=>setPage(p=>p-1)}>{t('Oldingi')}</Button><span>{page} / {Math.ceil(data.count/12)}</span><Button variant="outline" disabled={!data.next} onClick={()=>setPage(p=>p+1)}>{t('Keyingi')}</Button></div>}
  </div>;
}
