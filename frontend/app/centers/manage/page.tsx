'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ImageUp,KeyRound} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {useI18n} from '@/components/i18n';
import {Empty,Loading,LoginRequired,Notice} from '@/components/common';
import {CenterLogo} from '@/components/center-logo';
import {InviteCode} from '@/components/invite-code';
import {CenterShare} from '@/components/center-share';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {api,money} from '@/lib/api';
import {approvalLabel,type CenterFields,type MyCenter} from '@/lib/centers';
import '../centers.css';

export default function ManageCenterPage(){
  const {user,loading}=useAuth();const {t}=useI18n();
  const [data,setData]=useState<MyCenter|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  const userId=user?.id;
  useEffect(()=>{if(!userId)return;let active=true;setError('');api<MyCenter>('centers/mine/').then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[userId,retry]);
  if(loading)return <Loading/>;if(!user)return <LoginRequired next="/centers/manage"/>;
  const back=<Link href="/centers" className="back-link"><ArrowLeft size={16}/>{t('Markazlarga qaytish')}</Link>;
  if(user.profile.account_type==='parent')return <div className="dashboard-page centers-page">{back}<Empty title={t('Ota-ona hisobi bilan markaz ochib bo‘lmaydi.')}/></div>;
  const center=data?.center;
  return <div className="dashboard-page centers-page">{back}
    <header className="workspace-heading"><div><span className="eyebrow">{t('MARKAZNI BOSHQARISH')}</span><h1>{center?center.name:t('Markazim')}</h1><p>{t('Mentorlarni bitta brend ostida birlashtiring. Platforma 7% oladi, markaz ulushini har bir mentor bilan kelishasiz (0–40%).')}</p></div></header>
    {error&&<Notice kind="error">{t(error)}<button onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>}
    {!data?!error&&<Loading/>:center?<CenterPanel center={center} owner={data.role==='owner'} userId={user.id} onChange={setData}/>:<div className="center-start">
      <Card className="form-card"><h2>{t('Markaz ochish')}</h2><p>{t('Mentorlar jamoasi yoki mavjud offline o‘quv markazi sifatida ariza bering. Admin tasdiqlagach sahifangiz ochiladi.')}</p><CenterForm method="POST" onSaved={setData}/></Card>
      <Card className="form-card"><h2>{t('Kod bilan qo‘shilish')}</h2>{user.mentor?<JoinForm onJoined={setData}/>:<><p>{t('Markazga mentor sifatida qo‘shilasiz. Avval mentor profilingizni yarating.')}</p><Link className="btn btn-outline" href="/dashboard?tab=mentor">{t('Mentor profilini yaratish')}</Link></>}</Card>
    </div>}
  </div>;
}

function CenterPanel({center,owner,userId,onChange}:{center:NonNullable<MyCenter['center']>;owner:boolean;userId:number;onChange:(data:MyCenter)=>void}){
  const {t}=useI18n();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function remove(id:number){
    if(!window.confirm(t(id===userId?'Markazdan chiqasizmi?':'Mentor markazdan chiqarilsinmi? Taklif kodi yangilanadi.')))return;
    setBusy(true);setError('');
    try{await api(`centers/members/${id}/`,{method:'DELETE'});onChange(await api<MyCenter>('centers/mine/'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="center-manage">
    <Card className="center-status"><span className={`center-approval ${center.approval}`}>{t(approvalLabel[center.approval])}</span><p>{t(center.approval==='approved'?'Markaz sahifasi hammaga ochiq.':center.approval==='pending'?'Admin tasdiqlagach markaz sahifasi ochiladi.':'Ariza rad etildi. Ma’lumotlarni yangilab, qayta yuboring.')}</p>{center.approval==='approved'&&<Link className="text-link" href={`/centers/${center.id}`}>{t('Sahifani ko‘rish')} <ArrowUpRight size={16}/></Link>}</Card>
    {error&&<Notice kind="error">{t(error)}</Notice>}
    {owner&&<LogoCard center={center} onChange={onChange}/>}
    {owner&&center.invite_code&&<Card className="form-card center-invite"><span className="eyebrow"><KeyRound size={15}/>{t('MENTORLARNI TAKLIF QILISH')}</span><p>{t('Kodni mentorlarga yuboring. Ular «O‘quv markazlari → Markazim» sahifasida kodni kiritib qo‘shiladi. Mentorni chiqarsangiz, kod yangilanadi.')}</p><details className="center-code-reveal"><summary>{t('Taklif kodini ko‘rish')}</summary><InviteCode code={center.invite_code}/></details></Card>}
    <Card className="form-card"><h2>{t('Markaz mentorlari')}</h2>{owner&&<p>{t('Markaz ulushidan tushgan:')} <strong>{money(center.earned||0)}</strong></p>}{center.members.length?<ul className="center-members">{center.members.map(m=><li key={m.id}><span><strong>{m.full_name}</strong><small>{t(approvalLabel[m.approval])}</small><CenterShare member={m} owner={owner} self={m.id===userId} onChange={onChange} onError={setError}/></span>{(owner||m.id===userId)&&<Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>remove(m.id)}>{t(m.id===userId?'Chiqish':'Chiqarish')}</Button>}</li>)}</ul>:<p>{t('Hali mentor qo‘shilmagan. Kodni mentorlarga yuboring.')}</p>}</Card>
    {owner&&<Card className="form-card"><h2>{t('Markaz ma’lumotlari')}</h2><p>{t('O‘zgarishlar admin tomonidan qayta tekshiriladi.')}</p><CenterForm method="PUT" initial={center} onSaved={onChange}/></Card>}
  </div>;
}

function LogoCard({center,onChange}:{center:NonNullable<MyCenter['center']>;onChange:(data:MyCenter)=>void}){
  const {t}=useI18n();const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function send(file?:File){
    let body:FormData|undefined;if(file){body=new FormData();body.append('logo',file);}
    setBusy(true);setError('');
    try{onChange(await api<MyCenter>('centers/mine/logo/',{method:file?'POST':'DELETE',body}));}catch(e){setError((e as Error).message);}finally{setBusy(false);if(input.current)input.current.value='';}
  }
  return <Card className="form-card center-logo-card">
    <CenterLogo className="center-card-mark center-logo-preview" name={center.name} logo={center.logo}/>
    <div><h2>{t('Markaz logosi')}</h2><p>{t('Markaz sahifasi, katalog va reytingda ko‘rinadi. Kvadrat yoki shaffof fonli logo yaxshi chiqadi.')}</p><small>{t('JPEG, PNG, WebP · 2 MB gacha')}</small>
      {error&&<Notice kind="error">{t(error)}</Notice>}
      <div className="center-logo-actions"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>input.current?.click()}><ImageUp size={16} aria-hidden/>{t(busy?'Yuklanmoqda…':center.logo?'Logoni almashtirish':'Logo yuklash')}</Button>{center.logo&&<Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>send()}>{t('Olib tashlash')}</Button>}</div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(file)send(file);}}/>
    </div>
  </Card>;
}

function CenterForm({method,initial,onSaved}:{method:'POST'|'PUT';initial?:CenterFields;onSaved:(data:MyCenter)=>void}){
  const {t}=useI18n();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const body=JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)));setBusy(true);setError('');setNotice('');try{const result=await api<MyCenter>('centers/mine/',{method,body});onSaved(result);setNotice(result.center?.approval==='pending'?'Saqlandi. Admin tasdiqlagach ko‘rinadi.':'Saqlandi.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form className="form-stack" onSubmit={submit}>
    {error&&<Notice kind="error">{t(error)}</Notice>}{notice&&<Notice kind="success">{t(notice)}</Notice>}
    <label>{t('Markaz nomi')}<Input name="name" defaultValue={initial?.name} required maxLength={120}/></label>
    <label>{t('Markaz haqida')}<textarea name="description" defaultValue={initial?.description} required maxLength={2000} rows={4} placeholder={t('Qaysi fanlar, kimlar uchun va qanday ishlaysiz?')}/></label>
    <label>{t('Shahar · ixtiyoriy')}<Input name="city" defaultValue={initial?.city} maxLength={80}/></label>
    <Button disabled={busy}>{t(busy?'Saqlanmoqda…':method==='POST'?'Arizani yuborish':'Saqlash')}</Button>
  </form>;
}

function JoinForm({onJoined}:{onJoined:(data:MyCenter)=>void}){
  const {t}=useI18n();const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function join(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{onJoined(await api<MyCenter>('centers/join/',{method:'POST',body:JSON.stringify({code})}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form className="form-stack" onSubmit={join}><p>{t('Markaz egasi bergan kodni kiriting. Profilingizda markaz nomi ko‘rinadi; darslar, narx va to‘lovlar avvalgidek qoladi.')}</p>{error&&<Notice kind="error">{t(error)}</Notice>}<label>{t('Markaz kodi')}<Input className="center-code-input" value={code} onChange={e=>setCode(e.target.value)} placeholder="ABCD-2345" maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} required/></label><Button disabled={busy}>{t(busy?'Kutilmoqda…':'Qo‘shilish')}</Button></form>;
}
