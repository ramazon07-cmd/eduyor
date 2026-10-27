'use client';
import {useI18n} from '@/components/i18n';
import {useState} from 'react';
import {Check,Copy,CreditCard,ShieldCheck} from 'lucide-react';
import {money,percent} from '@/lib/api';
import type {PaymentInfo} from '@/lib/types';
import {Notice} from './common';
import {Button} from './ui/button';
export function PaymentCard({info,amount,commissionRate}:{info:PaymentInfo;amount:string;commissionRate:string}){
  const {t:translate}=useI18n();
  const [copied,setCopied]=useState(false);const [error,setError]=useState('');
  async function copy(){try{await navigator.clipboard.writeText(info.card_number);setCopied(true);setError('');}catch{setError('Nusxalab bo‘lmadi. Karta raqamini belgilab nusxalang.');}}
  return <div className="payment-recipient">{info.card_number?<><div className="bank-card"><div className="bank-card-top"><span><CreditCard size={18}/>{translate("EduYor")}</span><span>{info.bank_name||'KARTAGA O‘TKAZMA'}</span></div><div className="card-chip-art" aria-hidden="true"/><p className="bank-card-number">{info.card_number.match(/.{1,4}/g)?.join(' ')}</p><div className="bank-card-bottom"><div><small>{translate("KARTA EGASI")}</small><strong>{info.card_holder}</strong></div><Button type="button" size="sm" variant="ghost" onClick={copy} aria-label={translate("Platforma karta raqamini nusxalash")}>{copied?<Check size={17}/>:<Copy size={17}/>}<span>{translate(copied?'Nusxalandi':'Nusxalash')}</span></Button></div></div><div className="transfer-total"><span>{translate("Shu kartaga o‘tkazing")}</span><strong>{money(amount)}</strong></div></>:!info.can_accept_payment?<Notice kind="error">{translate("Karta rekvizitlari sozlanmagan. Pul yuborishdan oldin administratorga murojaat qiling.")}</Notice>:null}{error&&<Notice kind="error">{translate(error)}</Notice>}{info.instructions&&<p className="payment-instructions">{info.instructions}</p>}<p className="payment-assurance"><ShieldCheck size={15}/>{translate("To‘lov avval platforma kartasiga tushadi. Dars yakuni tasdiqlangach mentorga")} {+(100-percent(commissionRate)).toFixed(1)}{translate("% qo‘lda o‘tkaziladi;")} {percent(commissionRate)}{translate("% platformada qoladi.")}</p><p className="small muted">{translate("Yordam:")} {info.support}</p></div>;
}
