'use client';
import {useI18n} from '@/components/i18n';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api,money} from '@/lib/api';
import type {MentorSettings,Subject} from '@/lib/types';
import {useAuth} from './auth';
import {Avatar,Notice} from './common';
import {Card} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
const initial:MentorSettings={headline:'',bio:'',subjects:[],teaching_languages:'O‘zbekcha',hourly_price:'30000',is_paused:false,approval:'pending'};
const languages=['O‘zbekcha','English','Ruscha'];
const prices=['30000','35000','40000','45000','50000','55000','60000'];
function chosenLanguages(value:string){return value.split(/[,;/+]+/).map(v=>v.trim()).filter(Boolean).map(v=>/^(o[‘’ʻʼ'`]?zbek(cha| tili)?|uzbek|uz)$/i.test(v)?'O‘zbekcha':/^(english|ingliz(cha| tili)?|en)$/i.test(v)?'English':/^(rus(cha| tili)?|russian|русский|ru)$/i.test(v)?'Ruscha':v).filter((v,i,all)=>all.indexOf(v)===i);}
export function MentorForm(){
  const {t:translate}=useI18n();
  const {user,refresh}=useAuth();
  const [editing,setEditing]=useState(!user?.mentor);
  const [form,setForm]=useState<MentorSettings>(user?.mentor||initial);
  const [subjectsLoading,setSubjectsLoading]=useState(true);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState(false);
  function loadSubjects(){setSubjectsLoading(true);setError('');api<Subject[]>('subjects/').then(setSubjects).catch(e=>setError(e.message)).finally(()=>setSubjectsLoading(false));}
  useEffect(()=>{loadSubjects();},[]);
  function update(key:keyof MentorSettings,value:unknown){setForm(f=>({...f,[key]:value}));setSuccess('');}
  const selectedLanguages=chosenLanguages(form.teaching_languages);
  const languageOptions=Array.from(new Set([...languages,...selectedLanguages]));
  const priceOptions=Array.from(new Set([...prices,form.hourly_price])).sort((a,b)=>Number(a)-Number(b));
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setSuccess('');
    if(!form.subjects.length){setError('Kamida bitta yo‘nalish tanlang.');return;}
    if(!selectedLanguages.length){setError('Kamida bitta ta’lim tilini tanlang.');return;}
    setBusy(true);
    try{const result=await api<MentorSettings>('mentor/settings/',{method:'PUT',body:JSON.stringify({...form,teaching_languages:selectedLanguages.join(', ')})});setForm(result);await refresh();setSuccess('Mentor profilingiz saqlandi.');setEditing(false);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(user?.mentor&&!editing){
    const mentor=user.mentor;
    return <Card className="form-card mentor-profile-preview">
      <div className="section-heading"><div className="mentor-profile-identity"><Avatar name={user.profile.full_name} src={user.profile.avatar}/><div><h2>{user.profile.full_name}</h2><p>{mentor.headline}</p></div></div><Button onClick={()=>{setForm(mentor);setSuccess('');setEditing(true);}}>{translate("O‘zgartirish")}</Button></div>
      {success&&<Notice kind="success">{translate(success)}</Notice>}
      <Notice kind={mentor.approval==='approved'?'success':'info'}>{translate(mentor.is_paused?'Profilingiz pauzada.':mentor.approval==='approved'?'Mentor profilingiz tasdiqlangan.':mentor.approval==='rejected'?'Ariza rad etilgan. Ma’lumotlarni yangilab qayta yuboring.':'Arizangiz admin tekshiruvida.')}</Notice>
      <h3>{translate("Men haqimda")}</h3><p className="preserve">{mentor.bio}</p>
      <h3>{translate("Yo‘nalishlar")}</h3><div className="chips">{subjects.filter(s=>mentor.subjects.includes(s.id)).map(s=><span key={s.id} className="chip">{translate(s.name)}</span>)}</div>
      {error&&<Notice kind="error">{translate(error)}</Notice>}
      <div className="mentor-profile-facts"><div><small>{translate("Ta’lim tillari")}</small><strong>{chosenLanguages(mentor.teaching_languages).map(l=>translate(l==='English'?'Inglizcha':l)).join(', ')}</strong></div><div><small>{translate("Dars davomiyligi")}</small><strong>{translate("50 daqiqa")}</strong></div><div><small>{translate("Bir dars narxi")}</small><strong>{money(mentor.hourly_price)}</strong></div></div>
    </Card>;
  }
  return <Card className="form-card">
    <div className="section-heading compact"><div><h2>{translate(user?.mentor?'Mentor profilim':'Bilimingizni ulashing')}</h2><p>{translate("Bitta profil orqali o‘rganing va o‘rgating.")}</p></div></div>
    {user?.mentor&&<Notice kind={form.approval==='approved'?'success':'info'}>{translate(form.approval==='approved'?(form.is_paused?'Profil tasdiqlangan, lekin pauzada.':'Profilingiz tasdiqlangan va ro‘yxatda ko‘rinadi.'):form.approval==='rejected'?'Ariza rad etilgan. Ma’lumotni yangilab, qayta yuboring.':'Arizangiz admin tekshiruvida. Tasdiqlangach ommaga ko‘rinadi.')}</Notice>}
    {error&&<Notice kind="error">{translate(error)}</Notice>}{success&&<Notice kind="success">{translate(success)}</Notice>}
    {user?.mentor&&<Link href="/mentors" className="text-link own-listing-link">{translate("E’lonimni ro‘yxatda ko‘rish →")}</Link>}
    <form className="form-stack" onSubmit={submit}>
      <label>{translate("Qisqa sarlavha")}<Input value={form.headline} onChange={e=>update('headline',e.target.value)} placeholder={translate("Masalan, SAT matematikasini tushunarli o‘rgataman")} maxLength={140} required/></label>
      <label>{translate("O‘zingiz, tajribangiz va yutuqlaringiz haqida")}<textarea value={form.bio} onChange={e=>update('bio',e.target.value)} maxLength={3000} rows={5} required placeholder={translate("Qaysi yo‘nalishda yordam berasiz? Tajribangiz va haqiqiy natijalaringizni qisqacha yozing.")}/><small>{form.bio.length} {translate("/ 3000 belgi")}</small></label>
      <fieldset className="subject-fieldset"><legend>{translate("Qaysi yo‘nalishlarda dars berasiz?")}</legend><div className="checkbox-chips">{subjectsLoading&&<span role="status">{translate("Yo‘nalishlar yuklanmoqda…")}</span>}{!subjectsLoading&&!subjects.length&&<Notice>{translate("Yo‘nalishlar hozir mavjud emas.")}<button type="button" onClick={loadSubjects}>{translate("Qayta yuklash")}</button></Notice>}{subjects.map(s=><label key={s.id} className={form.subjects.includes(s.id)?'checked':''}><input type="checkbox" checked={form.subjects.includes(s.id)} onChange={e=>update('subjects',e.target.checked?[...form.subjects,s.id]:form.subjects.filter(id=>id!==s.id))}/>{translate(s.name)}</label>)}</div></fieldset>
      <fieldset className="subject-fieldset"><legend>{translate("Ta’lim tillari")} <span className="muted">{translate("· bir nechtasini tanlash mumkin")}</span></legend><div className="checkbox-chips language-choices">{languageOptions.map(language=><label key={language} className={selectedLanguages.includes(language)?'checked':''}><input type="checkbox" checked={selectedLanguages.includes(language)} onChange={e=>update('teaching_languages',(e.target.checked?[...selectedLanguages,language]:selectedLanguages.filter(item=>item!==language)).join(', '))}/>{translate(language==='English'?'Inglizcha':language)}</label>)}</div></fieldset>
      <label>{translate("Dars narxi · 50 daqiqa")}<select value={form.hourly_price} onChange={e=>update('hourly_price',e.target.value)} required>{priceOptions.map(price=><option key={price} value={price}>{money(price)}</option>)}</select><small>{translate("Yangi dars narxining 80% sizga qoladi. Platforma ulushi — 20%.")}</small></label>
      {user?.mentor&&<label className="check-row"><input type="checkbox" checked={form.is_paused} onChange={e=>update('is_paused',e.target.checked)}/>{translate("Profilni vaqtincha pauza qilish")}</label>}
      <small>{translate("Ma’lumot va yo‘nalishlar o‘zgarsa, profil qayta tekshiriladi. Dars vaqtini student tanlaydi.")}</small>
      <div className="form-actions">{user?.mentor&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{setForm(user.mentor!);setError('');setEditing(false);}}>{translate("Bekor qilish")}</Button>}<Button disabled={busy||!subjects.length}>{translate(busy?'Saqlanmoqda…':user?.mentor?'O‘zgarishlarni saqlash':'Ariza yuborish')}</Button></div>
    </form>
  </Card>;
}
