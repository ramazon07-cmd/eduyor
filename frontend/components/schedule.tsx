'use client';
import {useCallback,useEffect,useState} from 'react';
import {CalendarDays,Check,Copy,Plus,X} from 'lucide-react';
import {useI18n} from '@/components/i18n';
import {api} from '@/lib/api';
import type {Rule,Schedule} from '@/lib/types';
import {useAuth} from './auth';
import {Notice,Loading,Empty} from './common';
import {Card} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
import './schedule.css';

const weekdays=['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'];
const newRule=(weekday:number):Rule=>({weekday,start_time:'18:00',end_time:'21:00'});
const timeMinutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
function dayError(rules:Rule[]){
  if(rules.some(r=>!r.start_time||!r.end_time||timeMinutes(r.start_time)>=timeMinutes(r.end_time)))return 'Tugash vaqti boshlanishdan keyin bo‘lsin.';
  if(rules.some(r=>timeMinutes(r.end_time)-timeMinutes(r.start_time)<50))return 'Dars uchun kamida 50 daqiqa ajrating.';
  if(rules.some((a,i)=>rules.slice(i+1).some(b=>timeMinutes(a.start_time)<timeMinutes(b.end_time)&&timeMinutes(a.end_time)>timeMinutes(b.start_time))))return 'Bu kundagi vaqtlar kesishmasin.';
  return '';
}
export function ScheduleForm(){
  const {t}=useI18n();const {user}=useAuth();const hasMentor=!!user?.mentor;
  const [data,setData]=useState<Schedule|null>(null);
  const [error,setError]=useState('');const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);const [dirty,setDirty]=useState(false);const [blocked,setBlocked]=useState('');
  const [copyDay,setCopyDay]=useState<number|null>(null);const [copyTargets,setCopyTargets]=useState<number[]>([]);
  const load=useCallback(async()=>{setError('');try{setData(await api<Schedule>('mentor/availability/'));setDirty(false);}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{if(hasMentor)void load();},[hasMentor,user?.id,load]);
  if(!hasMentor)return <Empty title={t('Avval mentor profilingizni yarating')}><p>{t('So‘ng dars beradigan vaqtlaringizni belgilaysiz.')}</p></Empty>;
  if(!data)return error?<Notice kind="error">{t(error)} <Button variant="ghost" onClick={()=>void load()}>{t('Qayta urinish')}</Button></Notice>:<Loading/>;
  const current=data;
  const days=weekdays.map((_,day)=>data.rules.map((rule,index)=>({rule,index})).filter(({rule})=>rule.weekday===day));
  const invalid=days.some(rows=>!!dayError(rows.map(row=>row.rule)));
  function change(next:Schedule){setData(next);setDirty(true);setSuccess(false);setError('');}
  function toggle(day:number){change({...current,rules:days[day].length?current.rules.filter(r=>r.weekday!==day):[...current.rules,newRule(day)]});if(copyDay===day)setCopyDay(null);}
  function update(index:number,key:'start_time'|'end_time',value:string){change({...current,rules:current.rules.map((r,i)=>i===index?{...r,[key]:value}:r)});}
  function add(day:number){
    const last=days[day].at(-1)?.rule;
    const start=last?Math.ceil(timeMinutes(last.end_time)/60)*60:18*60;
    if(start>23*60)return;
    const format=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    change({...current,rules:[...current.rules,{weekday:day,start_time:format(start),end_time:format(Math.min(start+60,23*60+59))}]});
  }
  function applyCopy(){
    if(copyDay===null)return;
    const source=current.rules.filter(r=>r.weekday===copyDay);
    const next=[...current.rules.filter(r=>!copyTargets.includes(r.weekday)),...copyTargets.flatMap(weekday=>source.map(r=>({...r,weekday})))];
    if(next.length>35){setError('Jadvalda ko‘pi bilan 35 ta vaqt oralig‘i bo‘lishi mumkin.');return;}
    change({...current,rules:next});setCopyDay(null);
  }
  async function save(e:React.FormEvent){
    e.preventDefault();if(invalid||busy)return;setBusy(true);setError('');setSuccess(false);
    try{setData(await api<Schedule>('mentor/availability/',{method:'PUT',body:JSON.stringify(current)}));setDirty(false);setSuccess(true);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <Card className="form-card availability-editor">
    <header className="availability-heading"><div><span className="availability-caption"><CalendarDays size={16}/>{t('DARS JADVALI')}</span><h2>{t('Qachon dars bera olasiz?')}</h2><p>{t('Kunlarni yoqing va bo‘sh vaqtingizni belgilang.')}</p></div><span className="availability-duration">50 {t('daqiqa')}</span></header>
    {error&&<Notice kind="error">{t(error)}</Notice>}
    <form onSubmit={save}>
      <fieldset className="availability-fields" disabled={busy}><legend className="sr-only">{t('Haftalik jadval')}</legend>
        <div className="availability-week">{weekdays.map((day,weekday)=>{
          const rows=days[weekday];const enabled=rows.length>0;const validation=dayError(rows.map(row=>row.rule));
          return <div className={`availability-day ${enabled?'is-enabled':''}`} key={day}>
            <label className="availability-toggle"><input type="checkbox" checked={enabled} disabled={!enabled&&current.rules.length>=35} onChange={()=>toggle(weekday)}/><span className="availability-switch" aria-hidden="true"/><span>{t(day)}</span></label>
            <div className="availability-hours">{enabled?rows.map(({rule,index},i)=><div className="availability-time-row" key={index}>
              <Input type="time" aria-label={`${t(day)} · ${t('Boshlanish vaqti')} ${i+1}`} value={rule.start_time.slice(0,5)} onChange={e=>update(index,'start_time',e.target.value)} required aria-invalid={!!validation} aria-describedby={validation?`day-error-${weekday}`:undefined}/><span className="availability-dash">–</span>
              <Input type="time" aria-label={`${t(day)} · ${t('Tugash vaqti')} ${i+1}`} value={rule.end_time.slice(0,5)} onChange={e=>update(index,'end_time',e.target.value)} required aria-invalid={!!validation} aria-describedby={validation?`day-error-${weekday}`:undefined}/>
              <button type="button" className="availability-icon" aria-label={`${t(day)} · ${t('Oraliqni o‘chirish')} ${i+1}`} title={t('Oraliqni o‘chirish')} onClick={()=>{change({...current,rules:current.rules.filter((_,n)=>n!==index)});setCopyDay(null);}}><X size={16}/></button>
            </div>):<span className="availability-unavailable">{t('Dam olish')}</span>}
              {validation&&<p className="availability-validation" id={`day-error-${weekday}`}>{t(validation)}</p>}
            </div>
            {enabled&&<div className="availability-day-actions"><button type="button" className="availability-icon" aria-label={`${t(day)} · ${t('Vaqt qo‘shish')}`} title={t('Vaqt qo‘shish')} disabled={current.rules.length>=35||timeMinutes(rows.at(-1)!.rule.end_time)>23*60} onClick={()=>add(weekday)}><Plus size={18}/></button><button type="button" className="availability-icon" aria-label={`${t(day)} · ${t('Boshqa kunlarga nusxalash')}`} title={t('Boshqa kunlarga nusxalash')} aria-expanded={copyDay===weekday} aria-controls={`copy-hours-${weekday}`} disabled={!!validation} onClick={()=>{setCopyDay(copyDay===weekday?null:weekday);setCopyTargets([0,1,2,3,4].filter(d=>d!==weekday));}}><Copy size={16}/></button></div>}
            {copyDay===weekday&&<div className="availability-copy" id={`copy-hours-${weekday}`}><fieldset><legend>{t('Qaysi kunlarga qo‘llaymiz?')}</legend><p>{t('Tanlangan kunlardagi vaqtlar almashtiriladi.')}</p><div className="availability-copy-days">{weekdays.map((name,n)=>n!==weekday&&<label key={name}><input type="checkbox" checked={copyTargets.includes(n)} onChange={()=>setCopyTargets(targets=>targets.includes(n)?targets.filter(d=>d!==n):[...targets,n])}/><span>{t(name)}</span></label>)}</div></fieldset><div><Button type="button" size="sm" disabled={!copyTargets.length} onClick={applyCopy}>{t('Qo‘llash')}</Button><Button type="button" variant="ghost" size="sm" onClick={()=>setCopyDay(null)}>{t('Bekor qilish')}</Button></div></div>}
          </div>;
        })}</div>
        {!data.rules.length&&<p className="availability-empty">{t('Dars beradigan kamida bitta kunni yoqing.')}</p>}
        <details className="availability-exceptions"><summary><span><CalendarDays size={16}/>{t('Dam olish sanalari')}</span><span>{data.blocked_dates.length||'+'}</span></summary><p>{t('Bu sanalarda haftalik jadvaldan qat’i nazar yangi dars band qilinmaydi.')}</p><div className="availability-date-form"><Input type="date" aria-label={t('Dam olish sanasi')} value={blocked} onChange={e=>setBlocked(e.target.value)}/><Button type="button" variant="outline" disabled={!blocked||data.blocked_dates.length>=365} onClick={()=>{change({...current,blocked_dates:[...new Set([...current.blocked_dates,blocked])].sort()});setBlocked('');}}><Plus size={15}/>{t('Qo‘shish')}</Button></div><div className="availability-dates">{data.blocked_dates.map(date=><button type="button" key={date} onClick={()=>change({...current,blocked_dates:current.blocked_dates.filter(d=>d!==date)})} aria-label={`${date} · ${t('Sanani olib tashlash')}`}>{date}<X size={13}/></button>)}</div></details>
      </fieldset>
      <footer className="availability-footer"><span role="status" className={success?'availability-saved':''}>{success?<><Check size={16}/>{t('Jadval saqlandi.')}</>:dirty?t('Saqlanmagan o‘zgarishlar'):t('Har hafta takrorlanadi · darslar to‘liq soatda boshlanadi.')}</span><Button disabled={busy||invalid||!dirty}>{t(busy?'Saqlanmoqda…':'Jadvalni saqlash')}</Button></footer>
    </form>
  </Card>;
}
