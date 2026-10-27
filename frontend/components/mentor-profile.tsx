'use client';
import Link from 'next/link';
import {ArrowUpRight,Building2,Clock3,GraduationCap,Languages,MapPin,Sparkles,Star,Video} from 'lucide-react';
import {Avatar} from '@/components/common';
import {useI18n} from '@/components/i18n';
import {teachingLanguages} from '@/lib/i18n';
import {money} from '@/lib/api';
import {CenterLogo} from '@/components/center-logo';
import type {Mentor} from '@/lib/types';
import './mentor-profile.css';

const WEEKDAYS=['Du','Se','Ch','Pa','Ju','Sh','Ya'];

export function MentorProfileSummary({mentor}:{mentor:Mentor}){
  const {t:translate,locale}=useI18n();
  const lessons=mentor.lessons_completed??0,rated=mentor.rating_count??0,days=new Set(mentor.weekdays??[]);
  const education=[mentor.school,mentor.study_level].filter(Boolean).join(', ');
  return <aside className="mentor-summary mp">
    <div className="mp-head"><Avatar name={mentor.full_name} src={mentor.avatar}/><div>
      <div className="eyebrow mentor-label">{translate("MENTOR BILAN DARS")}</div>
      <h1>{mentor.full_name}</h1><h2>{mentor.headline}</h2>

    </div></div>
    <dl className="mp-stats">
      {lessons>0&&<div><dt>{translate("O‘tkazilgan darslar")}</dt><dd>{lessons}</dd></div>}
      {rated>0&&<div><dt>{translate("Reyting")}</dt><dd><Star size={16} aria-hidden/>{mentor.rating_average}</dd><small>{translate(`${rated} ta baho`)}</small></div>}
      {!lessons&&!rated&&<div className="mp-new"><Sparkles size={16} aria-hidden/>{translate("Yangi mentor")}</div>}
      {mentor.member_since&&<div><dt>{translate("Platformada")}</dt><dd>{mentor.member_since}</dd></div>}
    </dl>
    {mentor.center&&<section className="mp-center-panel" aria-label={translate('Mentorning o‘quv markazi')}>
      <div className="mp-center-heading"><Building2 size={16} aria-hidden/><span>{translate('O‘quv markazi')}</span></div>
      <div className="mp-center-identity"><CenterLogo className="mp-center-monogram" name={mentor.center.name} logo={mentor.center.logo}/><div><h3>{mentor.center.name}</h3><span>{translate(mentor.center.kind==='offline'?'Offline markaz':'Onlayn markaz')}</span></div></div>
      {mentor.center.description&&<p className="mp-center-description">{mentor.center.description}</p>}
      {(mentor.center.city||mentor.center.address)&&<p className="mp-center-address"><MapPin size={14} aria-hidden/><span>{[mentor.center.city,mentor.center.address].filter(Boolean).join(', ')}</span></p>}
      <Link className="mp-center-link" href={`/centers/${mentor.center.id}`}>{translate('Markaz va jamoani ko‘rish')}<ArrowUpRight size={16} aria-hidden/></Link>
    </section>}
    <section className="mp-section"><h3>{translate("Mentor haqida")}</h3><p className="mp-bio">{mentor.bio}</p></section>
    <section className="mp-section"><h3>{translate("Fanlar")}</h3><div className="chips">{mentor.subjects.map(s=><span className="chip" key={s.id}>{translate(s.name)}</span>)}</div></section>
    <dl className="mp-facts">
      <div><dt><Languages size={16} aria-hidden/>{translate("Dars tillari")}</dt><dd>{teachingLanguages(mentor.teaching_languages,locale)}</dd></div>
      {education&&<div><dt><GraduationCap size={16} aria-hidden/>{translate("Ta’lim")}</dt><dd>{education}</dd></div>}
      <div><dt><Video size={16} aria-hidden/>{translate("Dars formati")}</dt><dd>{translate("Google Meet")}, {mentor.session_duration_minutes} {translate("daqiqa")}</dd></div>
      <div><dt><MapPin size={16} aria-hidden/>{translate("Mentor vaqt zonasi")}</dt><dd>{mentor.timezone}</dd></div>
    </dl>
    {days.size>0&&<section className="mp-section"><h3><Clock3 size={16} aria-hidden/>{translate("Dars beradigan kunlar")}{days.size===7&&<span className="mp-week-note">{translate("Har kuni")}</span>}</h3>
      <ul className="mp-week">{WEEKDAYS.map((d,i)=><li key={d} className={days.has(i)?'on':''}>{translate(d)}<span className="sr-only">: {translate(days.has(i)?'Dars bor':'Dars yo‘q')}</span></li>)}</ul></section>}
    <div className="summary-price"><strong>{money(mentor.hourly_price)}</strong><span className="muted small"> {translate("/ bir dars")}</span><p>{translate("Qo‘shimcha platforma to‘lovi yo‘q.")}</p></div>
  </aside>;
}
