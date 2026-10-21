'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api,money} from '@/lib/api';
import type {MentorSettings,Subject} from '@/lib/types';
import {useAuth} from './auth';
import {Notice} from './common';
import {Card} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
const initial:MentorSettings={headline:'',bio:'',subjects:[],teaching_languages:'O‘zbekcha',hourly_price:'30000',is_paused:false,approval:'pending'};
const languages=['O‘zbekcha','English','Ruscha'];
const prices=['30000','35000','40000','45000','50000','55000','60000'];
function chosenLanguages(value:string){return value.split(/[,;/+]+/).map(v=>v.trim()).filter(Boolean).map(v=>/^(o[‘’ʻʼ'`]?zbek(cha| tili)?|uzbek|uz)$/i.test(v)?'O‘zbekcha':/^(english|ingliz(cha| tili)?|en)$/i.test(v)?'English':/^(rus(cha| tili)?|russian|русский|ru)$/i.test(v)?'Ruscha':v).filter((v,i,all)=>all.indexOf(v)===i);}
export function MentorForm(){
  const {user,refresh}=useAuth();
  const [form,setForm]=useState<MentorSettings>(user?.mentor||initial);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{api<Subject[]>('subjects/').then(setSubjects).catch(e=>setError(e.message));},[]);
  function update(key:keyof MentorSettings,value:unknown){setForm(f=>({...f,[key]:value}));setSuccess('');}
  const selectedLanguages=chosenLanguages(form.teaching_languages);
  const languageOptions=Array.from(new Set([...languages,...selectedLanguages]));
  const priceOptions=Array.from(new Set([...prices,form.hourly_price])).sort((a,b)=>Number(a)-Number(b));
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setSuccess('');
    if(!form.subjects.length){setError('Kamida bitta fan tanlang.');return;}
    if(!selectedLanguages.length){setError('Kamida bitta ta’lim tilini tanlang.');return;}
    setBusy(true);
    try{const result=await api<MentorSettings>('mentor/settings/',{method:'PUT',body:JSON.stringify({...form,teaching_languages:selectedLanguages.join(', ')})});setForm(result);await refresh();setSuccess('Mentor profilingiz saqlandi.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <Card className="form-card">
    <div className="section-heading compact"><div><h2>{user?.mentor?'Mentor profilim':'Bilimingizni ulashing'}</h2><p>Bitta profil orqali o‘rganing va o‘rgating.</p></div></div>
    {user?.mentor&&<Notice kind={form.approval==='approved'?'success':'info'}>{form.approval==='approved'?(form.is_paused?'Profil tasdiqlangan, lekin pauzada.':'Profilingiz tasdiqlangan va ro‘yxatda ko‘rinadi.'):form.approval==='rejected'?'Ariza rad etilgan. Ma’lumotni yangilab, qayta yuboring.':'Arizangiz admin tekshiruvida. Tasdiqlangach ommaga ko‘rinadi.'}</Notice>}
    {error&&<Notice kind="error">{error}</Notice>}{success&&<Notice kind="success">{success}</Notice>}
    {user?.mentor&&<Link href="/mentors" className="text-link own-listing-link">E’lonimni ro‘yxatda ko‘rish →</Link>}
    <form className="form-stack" onSubmit={submit}>
      <label>Qisqa sarlavha<Input value={form.headline} onChange={e=>update('headline',e.target.value)} placeholder="Masalan, SAT matematikasini tushunarli o‘rgataman" maxLength={140} required/></label>
      <label>O‘zingiz, tajribangiz va yutuqlaringiz haqida<textarea value={form.bio} onChange={e=>update('bio',e.target.value)} maxLength={3000} rows={5} required placeholder="Qaysi yo‘nalishda yordam berasiz? Tajribangiz va haqiqiy natijalaringizni qisqacha yozing."/><small>{form.bio.length} / 3000 belgi</small></label>
      <fieldset className="subject-fieldset"><legend>Qaysi fanlardan yordam bera olasiz?</legend><div className="checkbox-chips">{subjects.map(s=><label key={s.id} className={form.subjects.includes(s.id)?'checked':''}><input type="checkbox" checked={form.subjects.includes(s.id)} onChange={e=>update('subjects',e.target.checked?[...form.subjects,s.id]:form.subjects.filter(id=>id!==s.id))}/>{s.name}</label>)}</div></fieldset>
      <fieldset className="subject-fieldset"><legend>Ta’lim tillari <span className="muted">· bir nechtasini tanlash mumkin</span></legend><div className="checkbox-chips language-choices">{languageOptions.map(language=><label key={language} className={selectedLanguages.includes(language)?'checked':''}><input type="checkbox" checked={selectedLanguages.includes(language)} onChange={e=>update('teaching_languages',(e.target.checked?[...selectedLanguages,language]:selectedLanguages.filter(item=>item!==language)).join(', '))}/>{language==='English'?'Inglizcha':language}</label>)}</div></fieldset>
      <label>Dars narxi · 60 daqiqa<select value={form.hourly_price} onChange={e=>update('hourly_price',e.target.value)} required>{priceOptions.map(price=><option key={price} value={price}>{money(price)}</option>)}</select><small>Yangi dars narxining 80% sizga qoladi. Platforma ulushi — 20%.</small></label>
      {user?.mentor&&<label className="check-row"><input type="checkbox" checked={form.is_paused} onChange={e=>update('is_paused',e.target.checked)}/>Profilni vaqtincha pauza qilish</label>}
      <small>Ma’lumot va fanlar o‘zgarsa, profil qayta tekshiriladi. Dars vaqtini student tanlaydi.</small>
      <div className="form-actions"><Button disabled={busy||!subjects.length}>{busy?'Saqlanmoqda…':user?.mentor?'O‘zgarishlarni saqlash':'Ariza yuborish'}</Button></div>
    </form>
  </Card>;
}
