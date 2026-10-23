'use client';
import {Clock3,Globe,Wallet} from 'lucide-react';
import {useI18n} from './i18n';
import {money} from '@/lib/api';
import type {LearningRequest} from '@/lib/types';
export function RequestStatus({status}: {status:LearningRequest['status']}){
  const {t}=useI18n();
  return <span className={`request-status request-status-${status}`}>{t({open:'Ochiq',matched:'Mentor tanlangan',closed:'Yopilgan'}[status])}</span>;
}
export function RequestFacts({item}:{item:LearningRequest}){
  const {t}=useI18n();
  return <div className="request-facts"><span><Wallet size={15}/>{t('Budjet:')} <strong>{money(item.budget)}</strong></span><span><Globe size={15}/>{t('Onlayn')}</span><span><Clock3 size={15}/>{t('50 daqiqa')}</span></div>;
}
