'use client';
import Link from 'next/link';
import {ArrowUpRight,Users} from 'lucide-react';
import {useI18n} from './i18n';
import {CenterLogo} from './center-logo';
import type {Center} from '@/lib/centers';

// Landing-only center cards: tinted identity block on top, short description, one clear action.
export function CenterPreview({centers,href}:{centers:Center[];href:(path:string)=>string}){
  const {t}=useI18n();
  return <div className="cp-row">{centers.map(c=><Link key={c.id} href={href(`/centers/${c.id}`)} className="cp-card">
    <div className="cp-identity">
      <CenterLogo className="cp-logo" name={c.name} logo={c.logo}/>
      <div><h3>{c.name}</h3><span className="cp-count"><Users size={15} aria-hidden="true"/>{t(`${c.mentor_count} ta mentor`)}{c.city&&` · ${c.city}`}</span></div>
    </div>
    <div className="cp-body"><p>{c.description}</p><span className="cp-action">{t('Markazni ko‘rish')}<ArrowUpRight size={17} aria-hidden="true"/></span></div>
  </Link>)}</div>;
}
