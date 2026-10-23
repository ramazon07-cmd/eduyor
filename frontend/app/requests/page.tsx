'use client';
import Link from 'next/link';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUpRight,Plus,MessageSquare,ArrowRight} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {useI18n} from '@/components/i18n';
import {Empty,Loading,LoginRequired,Notice} from '@/components/common';
import {RequestFacts,RequestStatus} from '@/components/request-summary';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/api';
import type {LearningRequest,Page,Subject} from '@/lib/types';

type Scope='open'|'mine'|'offered';
export default function RequestsPage(){
  const {user,loading:authLoading}=useAuth();
  const {t}=useI18n();
  const router=useRouter();
  const [scope,setScope]=useState<Scope>('open');
  const [subject,setSubject]=useState('');
  const [page,setPage]=useState(1);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [data,setData]=useState<Page<LearningRequest>|null>(null);
  const [error,setError]=useState('');
  const [formError,setFormError]=useState('');
  const [busy,setBusy]=useState(false);
  const [creating,setCreating]=useState(false);
  const [retry,setRetry]=useState(0);
  const [subjectError,setSubjectError]=useState('');
  useEffect(()=>{let active=true;api<Subject[]>('subjects/').then(rows=>{if(active){setSubjects(rows);setSubjectError('');}}).catch(()=>{if(active)setSubjectError('Yo‘nalishlarni yuklab bo‘lmadi.');});return()=>{active=false;};},[retry]);
  useEffect(()=>{
    if(!user)return;
    let active=true;setData(null);setError('');
    const query=new URLSearchParams({scope,page:String(page)});if(subject)query.set('subject',subject);
    api<Page<LearningRequest>>(`requests/?${query}`).then(rows=>{if(active)setData(rows);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[user?.id,scope,subject,page,retry]);
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setFormError('');
    const values=Object.fromEntries(new FormData(event.currentTarget));
    try{const row=await api<LearningRequest>('requests/',{method:'POST',body:JSON.stringify(values)});router.push(`/requests/${row.id}`);}
    catch(e){setFormError((e as Error).message);setBusy(false);}
  }
  return <div className="request-page">
    <header className="request-heading"><div><span className="eyebrow">EDUYOR REQUEST</span><h1>{t('Savol sizdan. Yechim mentordan.')}</h1><p>{t('Muammongizni yozing, mentorlarning takliflarini solishtiring va o‘zingizga mosini tanlang.')}</p></div>{user&&<Button onClick={()=>{setCreating(value=>!value);setFormError('');}} aria-expanded={creating} aria-controls="request-create"><Plus size={17}/>{t(creating?'Yopish':'So‘rov yaratish')}</Button>}</header>
    {authLoading?<Loading/>:!user?<LoginRequired next="/requests"/>:<>
      {creating&&<section id="request-create" className="request-create"><div><span className="eyebrow">{t('YANGI YORDAM SO‘ROVI')}</span><h2>{t('Nimada yordam kerak?')}</h2><p>{t('Aniq mavzu va kutilgan natijani yozing. Shaxsiy aloqa ma’lumotlarini kiritmang.')}</p><div className="request-create-note">{t('Har bir taklif: 50 daqiqalik onlayn dars. Budjet: 30 000–60 000 UZS.')}</div></div><form onSubmit={create} className="form-stack"><label>{t('Sarlavha')}<input name="title" required maxLength={140} placeholder={t('Masalan, IELTS Writing Task 2 bo‘yicha yordam')}/></label><label>{t('Muammo va maqsad')}<textarea name="description" required maxLength={1500} rows={4} placeholder={t('Nimani tushunmayapsiz va darsdan qanday natija kutyapsiz?')}/></label><div className="request-form-row"><label>{t('Yo‘nalish')}<select name="subject" required defaultValue=""><option value="" disabled>{t('Yo‘nalishni tanlang')}</option>{subjects.map(row=><option value={row.id} key={row.id}>{t(row.name)}</option>)}</select></label><label>{t('Eng yuqori budjet (UZS)')}<input type="number" name="budget" min={30000} max={60000} step={1} defaultValue={50000} required/></label></div>{subjectError&&<Notice kind="error">{t(subjectError)}<button type="button" onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>}{formError&&<Notice kind="error">{t(formError)}</Notice>}<Button disabled={busy||!subjects.length}>{t(busy?'Saqlanmoqda…':'So‘rovni e’lon qilish')}<ArrowUpRight size={17}/></Button></form></section>}
      <div className="request-toolbar"><div className="request-tabs" role="group" aria-label={t('So‘rovlarni ko‘rsatish')}>{([['open','Ochiq so‘rovlar'],['mine','Mening so‘rovlarim'],['offered','Takliflarim']] as const).map(([value,label])=><button key={value} onClick={()=>{setScope(value);setPage(1);}} aria-pressed={scope===value}>{t(label)}</button>)}</div><select aria-label={t('Yo‘nalish bo‘yicha filtrlash')} value={subject} onChange={event=>{setSubject(event.target.value);setPage(1);}}><option value="">{t('Barcha yo‘nalishlar')}</option>{subjects.map(row=><option key={row.id} value={row.id}>{t(row.name)}</option>)}</select></div>
      {error?<Notice kind="error">{t(error)}<button onClick={()=>setRetry(n=>n+1)}>{t('Qayta urinish')}</button></Notice>:!data?<Loading/>:!data.results.length?<Empty title={t('Hozircha so‘rov yo‘q')}><p>{t(scope==='mine'?'Birinchi so‘rovingizni yarating va mentorlardan taklif oling.':scope==='offered'?'Mos so‘rovni oching va o‘z taklifingizni yuboring.':'Boshqa yo‘nalishni tanlang yoki keyinroq tekshiring.')}</p></Empty>:<><div className="request-feed">{data.results.map(item=><article className="request-list-item" key={item.id}><div className="request-item-top"><span className="request-subject">{t(item.subject.name)}</span><RequestStatus status={item.status}/></div><h2><Link href={`/requests/${item.id}`}>{item.title}</Link></h2><p className="request-excerpt">{item.description}</p><RequestFacts item={item}/><footer><span><MessageSquare size={16}/>{t(`${item.offer_count} ta taklif`)} · {item.student_name}</span><Link href={`/requests/${item.id}`}>{t('So‘rovni ochish')}<ArrowRight size={17}/></Link></footer></article>)}</div><nav className="request-pagination" aria-label={t('Sahifalar')}><Button variant="outline" disabled={!data.previous} onClick={()=>setPage(n=>n-1)}>{t('← Oldingi')}</Button><span>{page}</span><Button variant="outline" disabled={!data.next} onClick={()=>setPage(n=>n+1)}>{t('Keyingi →')}</Button></nav></>}
    </>}
  </div>;
}
