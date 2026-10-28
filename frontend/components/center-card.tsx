'use client';
import Link from 'next/link';
import {ArrowUpRight,Globe,MapPin,Users} from 'lucide-react';
import {useI18n} from './i18n';
import {CenterLogo} from './center-logo';
import type {Center} from '@/lib/centers';
import '@/app/centers/centers.css';

export function CenterCard({center:c}:{center:Center}){
  const {t}=useI18n();
  return <Link href={`/centers/${c.id}`} className="card center-card">
    <div className="center-card-identity"><CenterLogo className="center-card-mark" name={c.name} logo={c.logo}/><div><small>{t('O‘quv markazi')}</small><span className={`center-kind ${c.kind}`}>{c.kind==='online'?<Globe size={14}/>:<MapPin size={14}/>}{t(c.kind==='online'?'Onlayn markaz':'Offline markaz')}{c.city&&` · ${c.city}`}</span></div></div>
    <h2>{c.name}</h2><p>{c.description}</p>
    <span className="center-card-foot"><Users size={16}/>{t(`${c.mentor_count} ta mentor`)}<ArrowUpRight size={17}/></span>
  </Link>;
}
