'use client';
import {GraduationCap,Languages} from 'lucide-react';
import {useI18n} from './i18n';
import {Avatar} from './common';
import {money} from '@/lib/api';
import type {Mentor} from '@/lib/types';

// Landing-only showcase: one large portrait card plus two compact ones, no links into the app.
export function MentorPreview({mentors,loading}:{mentors:Mentor[];loading:boolean}){
  const {t}=useI18n();
  if(loading)return <div className="mp-grid" aria-busy="true">{[0,1,2].map(n=><div key={n} className="mp-card skeleton" aria-label={t('Mentor yuklanmoqda')}/>)}</div>;
  return <div className="mp-grid">{mentors.slice(0,3).map(m=><article key={m.id} className="mp-card">
    <div className="mp-photo"><Avatar name={m.full_name} src={m.avatar}/></div>
    <div className="mp-body">
      <div className="mp-subjects">{m.subjects.map(s=><span key={s.id}>{t(s.name)}</span>)}</div>
      <h3>{m.full_name}</h3>
      <p className="mp-headline">{m.headline}</p>
      <ul className="mp-facts">
        {m.school&&<li><GraduationCap size={16} aria-hidden="true"/>{m.school}</li>}
        {m.teaching_languages&&<li><Languages size={16} aria-hidden="true"/>{m.teaching_languages}</li>}
      </ul>
      <p className="mp-price"><strong>{money(m.hourly_price)}</strong> {t('/ dars')}</p>
    </div>
  </article>)}</div>;
}
