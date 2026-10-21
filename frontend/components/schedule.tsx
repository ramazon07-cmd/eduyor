'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Plus,Trash2} from 'lucide-react';
import {api} from '@/lib/api';
import type {Schedule} from '@/lib/types';
import {useAuth} from './auth';
import {Notice,Loading,Empty} from './common';
import {Card} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
const weekdays=['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'];
export function ScheduleForm(){
  const {user}=useAuth();const [data,setData]=useState<Schedule|null>(null);const [error,setError]=useState('');const [success,setSuccess]=useState(false);const [busy,setBusy]=useState(false);const [blocked,setBlocked]=useState('');
  useEffect(()=>{if(user?.mentor)api<Schedule>('mentor/availability/').then(setData).catch(e=>setError(e.message));},[user?.mentor]);
  if(!user?.mentor)return <Empty title="Avval mentor profilingizni yarating"><p>So‘ng dars beradigan vaqtlaringizni belgilaysiz.</p></Empty>;
  if(!data)return error?<Notice kind="error">{error} <button onClick={()=>api<Schedule>('mentor/availability/').then(setData).catch(e=>setError(e.message))}>Qayta urinish</button></Notice>:<Loading/>;
  const current=data;
  function update(index:number,key:string,value:string|number){setData(d=>d?{...d,rules:d.rules.map((r,i)=>i===index?{...r,[key]:value}:r)}:d);setSuccess(false);}
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess(false);try{setData(await api<Schedule>('mentor/availability/',{method:'PUT',body:JSON.stringify(current)}));setSuccess(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Card className="form-card"><h2>Haftalik jadval</h2><p className="muted">Har hafta shu vaqtlarda dars bera olasiz. Darslar 50 daqiqadan.</p><p className="small">Vaqt zonasi: <strong>{data.timezone}</strong> · <Link href="/profile" className="text-link">O‘zgartirish</Link></p>{error&&<Notice kind="error">{error}</Notice>}{success&&<Notice kind="success">Jadval saqlandi.</Notice>}<form onSubmit={save} className="form-stack"><div className="schedule-rules">{data.rules.map((r,i)=><div className="schedule-rule" key={i}><select aria-label={`${i+1}-oraliq kuni`} value={r.weekday} onChange={e=>update(i,'weekday',Number(e.target.value))}>{weekdays.map((d,n)=><option key={d} value={n}>{d}</option>)}</select><Input aria-label="Boshlanish vaqti" type="time" value={r.start_time.slice(0,5)} onChange={e=>update(i,'start_time',e.target.value)} required/><span className="muted">—</span><Input aria-label="Tugash vaqti" type="time" value={r.end_time.slice(0,5)} onChange={e=>update(i,'end_time',e.target.value)} required/><Button type="button" variant="ghost" aria-label="Oraliqni o‘chirish" onClick={()=>{setData({...data,rules:data.rules.filter((_,n)=>n!==i)});setSuccess(false);}}><Trash2 size={16}/></Button></div>)}</div><Button type="button" variant="outline" onClick={()=>{setData({...data,rules:[...data.rules,{weekday:0,start_time:'18:00',end_time:'21:00'}]});setSuccess(false);}} disabled={data.rules.length>=35}><Plus size={16}/>Vaqt oralig‘i qo‘shish</Button><small>Bir kunda bir nechta oraliq bo‘lishi mumkin. Ular kesishmasligi va tundan o‘tmasligi kerak. Mavjud tasdiqlangan darslar o‘zgarmaydi.</small><div className="blocked-section"><h3>Dam olish sanalari</h3><p className="small muted">Bu sanalarda haftalik jadvaldan qat’i nazar yangi dars band qilinmaydi.</p><div className="inline-form"><Input aria-label="Dam olish sanasi" type="date" value={blocked} onChange={e=>setBlocked(e.target.value)}/><Button type="button" variant="outline" disabled={!blocked} onClick={()=>{setData({...data,blocked_dates:[...new Set([...data.blocked_dates,blocked])].sort()});setBlocked('');setSuccess(false);}}>Qo‘shish</Button></div><div className="chips">{data.blocked_dates.map(d=><button type="button" className="chip removable" key={d} onClick={()=>{setData({...data,blocked_dates:data.blocked_dates.filter(x=>x!==d)});setSuccess(false);}} aria-label={`${d} sanani olib tashlash`}>{d} ×</button>)}</div></div><Button disabled={busy}>{busy?'Saqlanmoqda…':'Jadvalni saqlash'}</Button></form></Card>;
}
