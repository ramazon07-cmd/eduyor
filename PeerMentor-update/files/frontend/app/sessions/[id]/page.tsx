'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useCallback,useEffect,useState,useRef} from 'react';
import {Check,Clock3,Video,ArrowLeft,ArrowUpRight,ShieldCheck,ArrowRight,CalendarDays,ExternalLink,Wallet,AlertCircle,Copy} from 'lucide-react';
import {api,money,when,statusLabel} from '@/lib/api';
import type {Booking,PaymentInfo} from '@/lib/types';
import {useAuth} from '@/components/auth';
import {Loading,LoginRequired,Notice,Avatar} from '@/components/common';
import {PaymentCard} from '@/components/payment-card';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';

export default function SessionPage(){
  const {id}=useParams<{id:string}>();
  const loadedId=useRef('');
  const {user,loading}=useAuth();
  const [booking,setBooking]=useState<Booking|null>(null);
  const [info,setInfo]=useState<PaymentInfo|null>(null);
  const [error,setError]=useState('');const [success,setSuccess]=useState('');
  const [busy,setBusy]=useState(false);const [reference,setReference]=useState('');
  const [meeting,setMeeting]=useState('');const [note,setNote]=useState('');
  const [now,setNow]=useState(Date.now());
  const load=useCallback(async(quiet=false)=>{
    try{
      const b=await api<Booking>(`bookings/${id}/`);
      setBooking(b);
      if(loadedId.current!==id){setReference(b.payment_reference);setMeeting(b.meeting_url);loadedId.current=id;}
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
  if(!booking)return <div className="container section">{error?<Notice kind="error">{error}<button onClick={()=>load()}>Qayta urinish</button></Notice>:<Loading/>}</div>;
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
    <Link className="back-link" href="/dashboard"><ArrowLeft size={16}/>Darslarimga qaytish</Link>
    <div className="session-title-row"><div><div className="eyebrow">PEERMENTOR / DARS #{b.id}</div><h1>{expired?'Bron muddati tugagan':complete?'Yana bir qadam oldinga.':active?'Uchrashuv maydoningiz.':'Uchrashuvga bir qadam.'}</h1><p>{active?'Barcha tafsilotlar va darsga kirish — bir joyda.':'To‘lovni yuboring. Admin tasdiqlagach, mentor bilan uchrashing.'}</p></div><span className={`status status-${expired?'expired':b.status}`}>{expired?statusLabel.expired:statusLabel[b.status]}</span></div>
    {!expired&&b.status!=='cancelled'&&<div className="session-steps">{steps.map((s,i)=><div className={`session-step ${s.done?'done':''}`} key={s.label}><span>{s.done?<Check size={14}/>:<s.icon size={15}/>}</span><div><small>0{i+1}</small><strong>{s.label}</strong></div></div>)}</div>}
    {error&&<Notice kind="error">{error}</Notice>}{success&&<Notice kind="success">{success}</Notice>}
    <div className="session-layout"><div className="session-main">
      {(expired||b.status==='cancelled')&&<Notice>Pul yubormang. Oldin yuborgan bo‘lsangiz, {info?.support||'administrator'} orqali murojaat qiling. Kech tushgan to‘lov darsni avtomatik tasdiqlamaydi. <Link href={`/mentors/${b.mentor}`}>Yangi vaqt tanlash →</Link></Notice>}
      {liveHold&&<Card className="form-card payment-panel">
        <div className="panel-header"><span className="number-badge">01</span><div><h2>{b.payment_status==='submitted'?'Admin tasdig‘ini kutyapmiz':'To‘lovni yuboring'}</h2><p>Talaba to‘laydi: <strong>{money(b.total_price)}</strong></p></div></div>
        <div className="hold-timer"><span><Clock3 size={16}/><b>{remaining} daqiqa qoldi</b></span><small>{when(b.expires_at,tz)} · {tz}</small></div>
        {isStudent?<>
          {info?<PaymentCard info={info} amount={b.total_price}/>:<Loading/>}
          <form className="form-stack" onSubmit={e=>{e.preventDefault();void action('payment',{reference},'To‘lov xabari yuborildi. Admin kartaga pul tushganini tekshiradi.');}}>
            <label>Tranzaksiya raqami<Input value={reference} onChange={e=>setReference(e.target.value)} maxLength={160} required placeholder="Bank ilovasidagi tranzaksiya raqami"/><small>O‘tkazmani amalga oshirgach kiriting.</small></label>
            <Button disabled={busy||!info?.can_accept_payment}>{busy?'Yuborilmoqda…':b.payment_status==='submitted'?'To‘lov ma’lumotini yangilash':'Pul yubordim'}<ArrowRight size={16}/></Button>
          </form>
          <div className="subtle-info"><ShieldCheck size={16}/><p>“Pul yubordim” to‘lov tasdig‘i emas. Admin pul tushganini mustaqil tekshiradi. Bron muddati tekshiruv paytida ham amal qiladi; kech tushgan pul qo‘lda qaytariladi.</p></div>
        </>:<Notice>O‘quvchining to‘lovi va admin tasdig‘i kutilmoqda. Tasdiqlangach, shu yerga Google Meet havolasini qo‘shasiz.</Notice>}
      </Card>}
      {['refund_required','refunded'].includes(b.payment_status)&&<Notice kind={b.payment_status==='refunded'?'success':'info'}>{b.payment_status==='refund_required'?`To‘liq ${money(b.total_price)} qaytarilishi kerak. Admin qo‘lda qaytaradi.`:'Admin pul qaytarilganini qayd etdi.'}</Notice>}
      {active&&<Card className={`meet-room ${b.meeting_url?'meet-room-ready':''}`}>
        <div className="meet-room-top"><span className="meet-icon"><Video size={25}/></span><span className={`meet-room-label ${b.meeting_url?'ready':''}`}><span/>{b.meeting_url?'Havola tayyor':'Havola kutilmoqda'}</span></div>
        <span className="eyebrow">GOOGLE MEET / 60 DAQIQA</span>
        <h2>{b.meeting_url?'Suhbatdan boshlanadi.':isMentor?'Darsga yo‘l oching.':'Uchrashuvga tayyormiz.'}</h2>
        <p>{b.meeting_url?`${otherName} bilan onlayn uchrashuvingizga shu yerdan kiring.`:isMentor?'Google Meet’da uchrashuv yarating va havolani pastga kiriting. Student kabinetiga bildirishnoma keladi.':'Mentor Google Meet havolasini qo‘shgach shu yerda paydo bo‘ladi. Sahifa avtomatik yangilanadi.'}</p>
        {b.meeting_url?<><a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary meet-join"><Video size={18}/>Darsga qo‘shilish<ArrowUpRight size={17}/></a><div className="meet-url-row"><span>{b.meeting_url}</span><Button variant="ghost" size="sm" onClick={copyMeeting} aria-label="Meet havolasini nusxalash"><Copy size={14}/></Button></div></>:<div className="waiting-line"><span className="live-dot"/><span>Havola faqat siz va dars ishtirokchisiga ko‘rinadi.</span></div>}
        {isMentor&&b.status==='confirmed'&&<div className="meet-editor"><div className="meet-editor-heading"><h3>Studentga havola yuborish</h3><a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer">Meet ochish<ExternalLink size={12}/></a></div><form className="form-stack" onSubmit={e=>{e.preventDefault();void action('meeting',{meeting_url:meeting},'Havola saqlandi. Student kabinetida bildirishnoma paydo bo‘ladi.');}}><label className="sr-only" htmlFor="meeting-url">Google Meet havolasi</label><Input id="meeting-url" type="url" value={meeting} onChange={e=>setMeeting(e.target.value)} required placeholder="https://meet.google.com/abc-defg-hij"/><Button variant="outline" disabled={busy}>{busy?'Yuborilmoqda…':b.meeting_url?'Havolani yangilash':'Havolani studentga yuborish'}<ArrowRight size={15}/></Button></form></div>}
      </Card>}
      {active&&<Card className="completion-card"><span className="completion-icon">{complete?<Check size={22}/>:<ShieldCheck size={22}/>}</span><div><h3>{complete?'Dars yakunlangani tasdiqlandi':'Dars tugagach tasdiqlang'}</h3><p>{complete?(b.payout_status==='paid'?'Admin mentorga pul o‘tkazilganini qayd etdi.':'Mentorga 90% qo‘lda o‘tkazilishi kutilmoqda. Muammo bo‘lsa adminga yozing.'):'To‘lov dars yakuni tasdiqlanmaguncha mentorga o‘tkazilmaydi. Faqat vaqt tugashi yetarli emas.'}</p>{isStudent&&!complete&&<><Button disabled={busy||!ended||b.disputed} onClick={()=>action('complete',{},'Dars tasdiqlandi. Mentor to‘lovi adminga tayyor holatga o‘tdi.')}>Dars yakunlanganini tasdiqlash <Check size={15}/></Button>{!ended&&<small>{when(b.ends_at,tz)} dan keyin ochiladi.</small>}</>}</div></Card>}
      <Card className="form-card"><span className="eyebrow">BIR SOATLIK MAQSAD</span><h2>Bugun nimaga e’tibor beramiz?</h2><p className="preserve">{b.objective}</p></Card>
      {b.disputed&&<Notice>Muammo admin ko‘rib chiqishida. {b.issue_note}</Notice>}
      {b.resolution_note&&<Notice kind="success">Admin yechimi: {b.resolution_note}</Notice>}
      {!started&&['pending_payment','confirmed'].includes(b.status)&&!expired&&<div className="cancel-box"><p className="small muted">Rejangiz o‘zgardimi? Bekor qilib, yangi vaqtni band qilishingiz mumkin. Tekshirilgan to‘lov to‘liq qaytariladi.</p><Button variant="destructive" disabled={busy} onClick={()=>action('cancel',{},'Dars bekor qilindi. Vaqt bo‘shatildi.')}>Darsni bekor qilish</Button></div>}
      {started&&['confirmed','completed'].includes(b.status)&&<Card className="form-card"><div className="issue-heading"><AlertCircle size={18}/><h3>Muammo yuz berdimi?</h3></div><p className="small muted">Dars boshlanganidan keyingi masalalarni admin hal qiladi.</p><form onSubmit={e=>{e.preventDefault();void action('issue',{note},'Muammo adminga yuborildi.');}} className="form-stack"><label className="sr-only" htmlFor="issue">Muammo tafsiloti</label><textarea id="issue" value={note} onChange={e=>setNote(e.target.value)} required maxLength={1500} rows={2} placeholder="Nima bo‘lganini qisqacha yozing."/><Button variant="outline" disabled={busy}>Adminga yuborish</Button></form></Card>}
    </div><aside><Card className="session-summary new-session-summary"><span className="eyebrow">SIZNING UCHRASHUVINGIZ</span><div className="session-person"><Avatar name={otherName}/><div><small>{isStudent?'MENTOR':'O‘QUVCHI'}</small><h2>{otherName}</h2></div></div><div className="summary-item"><CalendarDays size={17}/><div><strong>{when(b.starts_at,tz)}</strong><p>60 daqiqa · {tz}</p></div></div><div className="summary-item"><Video size={17}/><span>Google Meet · yakkama-yakka</span></div><div className="price-lines"><div><span>Dars narxi</span><strong>{money(b.total_price)}</strong></div><div><span>Qo‘shimcha to‘lov</span><span>0 UZS</span></div><div><span>To‘lov holati</span><span>{statusLabel[b.payment_status]}</span></div></div><div className="funds-flow"><div><span>Platformada qoladi · 10%</span><strong>{money(b.platform_fee)}</strong></div><div><span>Mentorga · 90%</span><strong>{money(b.mentor_net)}</strong></div><p>{['refund_required','refunded'].includes(b.payment_status)?statusLabel[b.payment_status]:['cancelled','expired'].includes(b.status)?'Bu dars uchun mentor to‘lovi hisoblanmaydi.':complete?statusLabel[b.payout_status]:'Dars yakuni tasdiqlangach qo‘lda o‘tkaziladi.'}</p></div><p className="private-note"><ShieldCheck size={16}/>To‘lov va Meet havolasi faqat dars ishtirokchilariga ochiq.</p></Card></aside></div>
  </div>;
}
