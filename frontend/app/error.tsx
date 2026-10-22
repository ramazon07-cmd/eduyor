'use client';
import {useI18n} from '@/components/i18n';
export default function ErrorPage({reset}:{reset:()=>void}){
  const {t:translate}=useI18n();return <div className="container section narrow"><h1>{translate("Sahifani yuklab bo‘lmadi.")}</h1><p>{translate("Qayta urinib ko‘ring.")}</p><button className="btn btn-primary" onClick={reset}>{translate("Qayta urinish")}</button></div>;}
