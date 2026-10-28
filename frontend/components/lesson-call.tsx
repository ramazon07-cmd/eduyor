'use client';
import {Mic,MicOff,Video,PhoneOff,MonitorUp,UserRound} from 'lucide-react';
import {useI18n} from './i18n';
import {Avatar} from './common';
import type {Mentor} from '@/lib/types';

// A mock one-to-one call: one real mentor photo; the student tile is the viewer, so it shows an icon, never another person's photo.
export function LessonCall({mentors}:{mentors:Mentor[]}){
  const {t}=useI18n();
  const mentor=mentors.find(m=>m.avatar);
  const tile=(person:Mentor|undefined,label:string,speaking:boolean)=><div className={`lesson-call-tile${speaking?' speaking':''}`}>
    {person?<Avatar name={person.full_name} src={person.avatar}/>:<span className="avatar lesson-call-you"><UserRound size={36} strokeWidth={1.6} aria-hidden="true"/></span>}
    <span className="lesson-call-name">{speaking?<Mic size={12}/>:<MicOff size={12}/>}{label}</span>
  </div>;
  return <div className="lesson-call" role="img" aria-label={t('Mentor va o‘quvchi onlayn darsda')}>
    <span className="lesson-call-live">● {t('Onlayn dars')} · 50:00</span>
    <div className="lesson-call-grid">{tile(mentor,mentor?.full_name||t('Mentor'),true)}{tile(undefined,t('Siz'),false)}</div>
    <div className="lesson-call-bar" aria-hidden="true"><span><Mic size={15}/></span><span><Video size={15}/></span><span><MonitorUp size={15}/></span><span className="end"><PhoneOff size={15}/></span></div>
  </div>;
}
