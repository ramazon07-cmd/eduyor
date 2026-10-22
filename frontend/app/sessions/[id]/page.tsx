'use client';
import {useI18n} from '@/components/i18n';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useCallback,useEffect,useState,useRef} from 'react';
import {Check,Clock3,Video,ArrowLeft,ArrowUpRight,ShieldCheck,ArrowRight,CalendarDays,ExternalLink,Wallet,AlertCircle,Copy,Star} from 'lucide-react';
import {api,money,when,statusLabel} from '@/lib/api';
import type {Booking,PaymentInfo} from '@/lib/types';
import {useAuth} from '@/components/auth';
import {Loading,LoginRequired,Notice,Avatar} from '@/components/common';
import {LessonFeedback} from '@/components/lesson-feedback';
import {PaymentReceipt} from '@/components/payment-receipt';
import {PaymentCard} from '@/components/payment-card';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';

export default function SessionPage(){
  const {t:translate,locale}=useI18n();
  const {id}=useParams<{id:string}>();
  const loadedId=useRef('');
  const {user,loading}=useAuth();
  const [booking,setBooking]=useState<Booking|null>(null);
  const [info,setInfo]=useState<PaymentInfo|null>(null);
  const [error,setError]=useState('');const [success,setSuccess]=useState('');
  const [busy,setBusy]=useState(false);
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  useEffect(()=>{setFeedbackOpen(false);},[id]);
  const [meeting,setMeeting]=useState('');const [note,setNote]=useState('');
  const [now,setNow]=useState(Date.now());
  const load=useCallback(async(quiet=false)=>{
    try{
      const b=await api<Booking>(`bookings/${id}/`);
      setBooking(previous=>previous?.id===b.id&&previous.feedback_rating?{...b,feedback_rating:previous.feedback_rating,feedback_comment:previous.feedback_comment||b.feedback_comment,feedback_submitted_at:previous.feedback_submitted_at||b.feedback_submitted_at}:b);
      if(loadedId.current!==id){setMeeting(b.meeting_url);loadedId.current=id;}
      if(!quiet)setError('');
    }catch(e){if(!quiet)setError((e as Error).message);}
  },[id]);
  useEffect(()=>{
    if(!user)return;
    void load();api<PaymentInfo>('payment-info/').then(setInfo).catch(e=>setError(e.message));
    const timer=setInterval(()=>{void load(true);setNow(Date.now());},15000);
    return()=>clearInterval(timer);
  },[user?.id,load]);
  async function action(type:string,payload:object={},message='Saqlandi.'){
    setBusy(true);setError('');setSuccess('');
    try{setBooking(await api<Booking>(`bookings/${id}/${type}/`,{method:'POST',body:JSON.stringify(payload)}));setSuccess(message);setNow(Date.now());}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function copyMeeting(){try{await navigator.clipboard.writeText(booking!.meeting_url);setSuccess('Google Meet havolasi nusxalandi.');}catch{setError('Havolani nusxalab bo‘lmadi. Darsga qo‘shilish tugmasidan foydalaning.');}}
  if(loading)return <Loading/>;
  if(!user)return <LoginRequired next={`/sessions/${id}`}/>;
  if(!booking)return <div className="container section">{error?<Notice kind="error">{translate(error)}<button onClick={()=>load()}>{translate("Qayta urinish")}</button></Notice>:<Loading/>}</div>;
  const b=booking,tz=user.profile.timezone,isStudent=b.student===user.id,isMentor=b.mentor===user.id;
  const expired=b.status==='expired'||b.status==='pending_payment'&&new Date(b.expires_at).getTime()<=now;
  const liveHold=b.status==='pending_payment'&&!expired;
  const started=new Date(b.starts_at).getTime()<=now,ended=new Date(b.ends_at).getTime()<=now;
  const verified=b.payment_status==='verified',complete=b.status==='completed',active=['confirmed','completed'].includes(b.status)&&verified;
  const otherName=isStudent?b.mentor_name:b.student_name;
  const remaining=Math.max(0,Math.ceil((new Date(b.expires_at).getTime()-now)/60000));
  const steps=[
    {label:'Vaqt band qilindi',done:true,icon:CalendarDays},
    {label:'To‘lov tasdiqlandi',done:verified,icon:ShieldCheck},
    {label:'Dars yakunlandi',done:complete,icon:Video},
    {label:'Mentorga o‘tkazildi',done:b.payout_status==='paid',icon:Wallet},
  ];
  return <div className="container section session-workspace">
    {isStudent&&complete&&verified&&(feedbackOpen||!b.feedback_rating)&&<LessonFeedback key={b.id} booking={b} onSaved={updated=>{setBooking(updated);setFeedbackOpen(true);}} onClose={()=>setFeedbackOpen(false)}/>}
    <Link className="back-link" href="/dashboard"><ArrowLeft size={16}/>{translate("Darslarimga qaytish")}</Link>
    <div className="session-title-row"><div><div className="eyebrow">{translate("EduYor / DARS #")}{b.id}</div><h1>{translate(expired?'Bron muddati tugagan':complete?'Yana bir qadam oldinga.':active?'Uchrashuv maydoningiz.':'Uchrashuvga bir qadam.')}</h1><p>{translate(active?'Barcha tafsilotlar va darsga kirish — bir joyda.':'To‘lovni yuboring. Admin tasdiqlagach, mentor bilan uchrashing.')}</p></div><span className={`status status-${expired?'expired':b.status}`}>{translate(expired?statusLabel.expired:statusLabel[b.status])}</span></div>
    {!expired&&b.status!=='cancelled'&&<div className="session-steps">{steps.map((s,i)=><div className={`session-step ${s.done?'done':''}`} key={s.label}><span>{s.done?<Check size={14}/>:<s.icon size={15}/>}</span><div><small>0{i+1}</small><strong>{translate(s.label)}</strong></div></div>)}</div>}
    {error&&<Notice kind="error">{translate(error)}</Notice>}{success&&<Notice kind="success">{translate(success)}</Notice>}
    <div className="session-layout"><div className="session-main">
      {(expired||b.status==='cancelled')&&<Notice>{translate("Pul yubormang. Oldin yuborgan bo‘lsangiz,")} {info?.support||'administrator'} {translate("orqali murojaat qiling. Kech tushgan to‘lov darsni avtomatik tasdiqlamaydi.")} <Link href={`/mentors/${b.mentor}`}>{translate("Yangi vaqt tanlash →")}</Link></Notice>}
      {liveHold&&<Card className="form-card payment-panel">
        <div className="panel-header"><span className="number-badge">01</span><div><h2>{translate(b.payment_status==='submitted'?'Admin tasdig‘ini kutyapmiz':'To‘lovni yuboring')}</h2><p>{translate("Talaba to‘laydi:")} <strong>{money(b.total_price)}</strong></p></div></div>
        <div className="hold-timer"><span><Clock3 size={16}/><b>{remaining} {translate("daqiqa qoldi")}</b></span><small>{translate(when(b.expires_at,tz,locale))} · {tz}</small></div>
        {isStudent?<>
          {b.payment_status!=='submitted'&&(info?<PaymentCard info={info} amount={b.total_price} commissionRate={b.commission_rate}/>:<Loading/>)}
          <PaymentReceipt bookingId={b.id} submitted={b.payment_status==='submitted'} onUploaded={async()=>{await load();}}/>
          <div className="subtle-info"><ShieldCheck size={16}/><p>{translate("Chekni yuboring — admin tekshiradi va tasdiqlaydi. Dars pul tushgani tasdiqlangach ochiladi.")}</p></div>
        </>:<Notice>{translate("O‘quvchining to‘lovi va admin tasdig‘i kutilmoqda. Tasdiqlangach, shu yerga Google Meet havolasini qo‘shasiz.")}</Notice>}
      </Card>}
      {['refund_required','refunded'].includes(b.payment_status)&&<Notice kind={b.payment_status==='refunded'?'success':'info'}>{translate(b.payment_status==='refund_required'?`To‘liq ${money(b.total_price)} qaytarilishi kerak. Admin qo‘lda qaytaradi.`:'Admin pul qaytarilganini qayd etdi.')}</Notice>}
      {active&&<Card className={`meet-room ${b.meeting_url?'meet-room-ready':''}`}>
        <div className="meet-room-top"><span className="meet-icon"><Video size={25}/></span><span className={`meet-room-label ${b.meeting_url?'ready':''}`}><span/>{translate(b.meeting_url?'Havola tayyor':'Havola kutilmoqda')}</span></div>
        <span className="eyebrow">{translate("GOOGLE MEET /")} {b.duration_minutes} {translate("DAQIQA")}</span>
        <h2>{translate(b.meeting_url?'Suhbatdan boshlanadi.':isMentor?'Darsga yo‘l oching.':'Uchrashuvga tayyormiz.')}</h2>
        <p>{translate(b.meeting_url?`${otherName} bilan onlayn uchrashuvingizga shu yerdan kiring.`:isMentor?'Google Meet’da uchrashuv yarating va havolani pastga kiriting. Student kabinetiga bildirishnoma keladi.':'Mentor Google Meet havolasini qo‘shgach shu yerda paydo bo‘ladi. Sahifa avtomatik yangilanadi.')}</p>
        {b.meeting_url?<><a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary meet-join"><Video size={18}/>{translate("Darsga qo‘shilish")}<ArrowUpRight size={17}/></a><div className="meet-url-row"><span>{b.meeting_url}</span><Button variant="ghost" size="sm" onClick={copyMeeting} aria-label={translate("Meet havolasini nusxalash")}><Copy size={14}/></Button></div></>:<div className="waiting-line"><span className="live-dot"/><span>{translate("Havola faqat siz va dars ishtirokchisiga ko‘rinadi.")}</span></div>}
        {isMentor&&b.status==='confirmed'&&<div className="meet-editor"><div className="meet-editor-heading"><h3>{translate("Studentga havola yuborish")}</h3><a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer">{translate("Meet ochish")}<ExternalLink size={12}/></a></div><form className="form-stack" onSubmit={e=>{e.preventDefault();void action('meeting',{meeting_url:meeting},'Havola saqlandi. Student kabinetida bildirishnoma paydo bo‘ladi.');}}><label className="sr-only" htmlFor="meeting-url">{translate("Google Meet havolasi")}</label><Input id="meeting-url" type="url" value={meeting} onChange={e=>setMeeting(e.target.value)} required placeholder={translate("https://meet.google.com/abc-defg-hij")}/><Button variant="outline" disabled={busy}>{translate(busy?'Yuborilmoqda…':b.meeting_url?'Havolani yangilash':'Havolani studentga yuborish')}<ArrowRight size={15}/></Button></form></div>}
      </Card>}
      {active&&<Card className="completion-card"><span className="completion-icon">{complete?<Check size={22}/>:<ShieldCheck size={22}/>}</span><div><h3>{translate(complete?'Dars yakunlangani tasdiqlandi':'Dars tugagach tasdiqlang')}</h3><p>{translate(complete?(b.payout_status==='paid'?'Admin mentorga pul o‘tkazilganini qayd etdi.':'Mentor ulushi qo‘lda o‘tkazilishi kutilmoqda. Muammo bo‘lsa adminga yozing.'):'To‘lov dars yakuni tasdiqlanmaguncha mentorga o‘tkazilmaydi. Faqat vaqt tugashi yetarli emas.')}</p>{isStudent&&!complete&&<><Button disabled={busy||!ended||b.disputed} onClick={()=>action('complete',{},'Dars tasdiqlandi. Mentor to‘lovi adminga tayyor holatga o‘tdi.')}>{translate("Dars yakunlanganini tasdiqlash")} <Check size={15}/></Button>{!ended&&<small>{translate(when(b.ends_at,tz,locale))} {translate("dan keyin ochiladi.")}</small>}</>}{complete&&b.feedback_rating&&<div className="lesson-feedback-result"><span>{[1,2,3,4,5].map(value=><Star key={value} size={16} fill={value<=(b.feedback_rating||0)?'currentColor':'none'}/>)} {b.feedback_rating} / 5 · {translate(isStudent?'Sizning bahoyingiz':'O‘quvchi bahosi')}</span>{b.feedback_comment&&<p>{b.feedback_comment}</p>}{isStudent&&!b.feedback_comment&&<Button variant="ghost" size="sm" onClick={()=>setFeedbackOpen(true)}>{translate('Izoh qo‘shish')}</Button>}</div>}</div></Card>}
      <Card className="form-card"><span className="eyebrow">{translate("DARS MAQSADI")}</span><h2>{translate("Bugun nimaga e’tibor beramiz?")}</h2><p className="preserve">{b.objective}</p></Card>
      {b.disputed&&<Notice>{translate("Muammo admin ko‘rib chiqishida.")} {b.issue_note}</Notice>}
      {b.resolution_note&&<Notice kind="success">{translate("Admin yechimi:")} {b.resolution_note}</Notice>}

      {started&&['confirmed','completed'].includes(b.status)&&<Card className="form-card"><div className="issue-heading"><AlertCircle size={18}/><h3>{translate("Muammo yuz berdimi?")}</h3></div><p className="small muted">{translate("Dars boshlanganidan keyingi masalalarni admin hal qiladi.")}</p><form onSubmit={e=>{e.preventDefault();void action('issue',{note},'Muammo adminga yuborildi.');}} className="form-stack"><label className="sr-only" htmlFor="issue">{translate("Muammo tafsiloti")}</label><textarea id="issue" value={note} onChange={e=>setNote(e.target.value)} required maxLength={1500} rows={2} placeholder={translate("Nima bo‘lganini qisqacha yozing.")}/><Button variant="outline" disabled={busy}>{translate("Adminga yuborish")}</Button></form></Card>}
    </div><aside><Card className="session-summary new-session-summary"><span className="eyebrow">{translate("SIZNING UCHRASHUVINGIZ")}</span><div className="session-person"><Avatar name={otherName}/><div><small>{translate(isStudent?'MENTOR':'O‘QUVCHI')}</small><h2>{otherName}</h2></div></div><div className="summary-item"><CalendarDays size={17}/><div><strong>{translate(when(b.starts_at,tz,locale))}</strong><p>{b.duration_minutes} {translate("daqiqa ·")} {tz}</p></div></div><div className="summary-item"><Video size={17}/><span>{translate("Google Meet · yakkama-yakka")}</span></div><div className="price-lines"><div><span>{translate("Dars narxi")}</span><strong>{money(b.total_price)}</strong></div><div><span>{translate("Qo‘shimcha to‘lov")}</span><span>{translate("0 UZS")}</span></div><div><span>{translate("To‘lov holati")}</span><span>{translate(statusLabel[b.payment_status])}</span></div></div><div className="funds-flow"><div><span>{translate("Platformada qoladi ·")} {Math.round(Number(b.commission_rate)*100)}%</span><strong>{money(b.platform_fee)}</strong></div><div><span>{translate("Mentorga ·")} {100-Math.round(Number(b.commission_rate)*100)}%</span><strong>{money(b.mentor_net)}</strong></div><p>{translate(['refund_required','refunded'].includes(b.payment_status)?statusLabel[b.payment_status]:['cancelled','expired'].includes(b.status)?'Bu dars uchun mentor to‘lovi hisoblanmaydi.':complete?statusLabel[b.payout_status]:'Dars yakuni tasdiqlangach qo‘lda o‘tkaziladi.')}</p></div><p className="private-note"><ShieldCheck size={16}/>{translate("To‘lov va Meet havolasi faqat dars ishtirokchilariga ochiq.")}</p></Card></aside></div>
  </div>;
}
