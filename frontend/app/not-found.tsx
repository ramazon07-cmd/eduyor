'use client';
import {useI18n} from '@/components/i18n';
import Link from 'next/link';
export default function NotFound(){
  const {t:translate}=useI18n();return <div className="container section narrow"><h1>{translate("Sahifa topilmadi.")}</h1><p className="muted">{translate("Boshqa sahifaga o‘ting.")}</p><Link href="/mentors" className="btn btn-primary">{translate("Mentor topish →")}</Link></div>;}
