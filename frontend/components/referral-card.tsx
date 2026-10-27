'use client';
import {useEffect,useState} from 'react';
import {Gift} from 'lucide-react';
import {useI18n} from './i18n';
import {Notice} from './common';
import {Card} from './ui/card';
import {InviteCode} from './invite-code';
import {api} from '@/lib/api';
import type {Referral} from '@/lib/types';
import './parent-access.css';

export function ReferralCard(){
  const {t}=useI18n();
  const [data,setData]=useState<Referral|null>(null);const [error,setError]=useState('');const [origin,setOrigin]=useState('');
  useEffect(()=>{setOrigin(window.location.origin);let active=true;api<Referral>('referrals/').then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  if(error)return <Card className="form-card parent-access"><Notice kind="error">{t(error)}</Notice></Card>;
  if(!data)return null;
  return <Card className="form-card parent-access" id="referrals">
    <h2><Gift size={22} aria-hidden="true"/>{t('Do‘st taklif qiling')}</h2>
    <p>{t('Taklif qilgan do‘stingiz birinchi pullik darsini tugatsa, sizga 1 token beriladi. 10 token = 1 bepul dars.')}</p>
    <InviteCode code={data.code}><small className="muted">{origin}/register?ref={data.code}</small></InviteCode>
    <ul className="parent-list">
      <li><span><strong>{data.balance} / {data.tokens_per_lesson}</strong><small>{t('Tokenlar')}</small></span></li>
      <li><span><strong>{data.invited}</strong><small>{t('Ro‘yxatdan o‘tganlar')}</small></span><span><strong>{data.rewarded}</strong><small>{t('Token keltirganlar')}</small></span></li>
    </ul>
    {data.can_redeem&&<Notice kind="success">{t('Bepul dars tayyor. Mentor sahifasida «Tokenlar bilan to‘lash»ni belgilang.')}</Notice>}
  </Card>;
}
