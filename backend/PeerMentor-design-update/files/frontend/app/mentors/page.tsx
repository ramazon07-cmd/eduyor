'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import {Search,SlidersHorizontal,ArrowLeft,ArrowRight} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice,Empty} from '@/components/common';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export default function Directory(){
  const {user,refresh}=useAuth();const requestId=useRef(0);const [data,setData]=useState<Page<Mentor>|null>(null);const [subjects,setSubjects]=useState<Subject[]>([]);const [search,setSearch]=useState('');const [subject,setSubject]=useState('');const [price,setPrice]=useState('');const [page,setPage]=useState(1);const [query,setQuery]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{if(user?.id)void refresh();},[user?.id,refresh]);
  const load=useCallback(async()=>{const request=++requestId.current;setLoading(true);setError('');try{const result=await api<Page<Mentor>>(`mentors/?${query}&page=${page}&exclude_self=1`);if(request===requestId.current)setData(result);}catch(e){if(request===requestId.current)setError((e as Error).message);}finally{if(request===requestId.current)setLoading(false);}},[query,page]);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const s=params.get('search')||'';const subject=params.get('subject')||'';setSearch(s);setSubject(subject);setQuery(new URLSearchParams({search:s,subject}).toString());api<Subject[]>('subjects/').then(setSubjects).catch(()=>{});},[]);
  useEffect(()=>{void load();},[load]);
  function filter(e:React.FormEvent){e.preventDefault();setPage(1);setQuery(new URLSearchParams({search,subject,max_price:price}).toString());}
  function reset(){setSearch('');setSubject('');setPrice('');setPage(1);setQuery('');}
  const own=user?.mentor_listing;
  const applied=new URLSearchParams(query);
  const term=(applied.get('search')||'').toLowerCase();
  const subjectId=applied.get('subject');const maxPrice=applied.get('max_price');
  const ownMatches=!!own&&(!term||[own.full_name,own.headline,...own.subjects.map(s=>s.name)].join(' ').toLowerCase().includes(term))&&(!subjectId||own.subjects.some(s=>String(s.id)===subjectId))&&(!maxPrice||Number(own.hourly_price)<=Number(maxPrice));
  const showOwn=ownMatches&&page===1;
  const rows=data?.results.filter(m=>!showOwn||m.id!==own?.id)||[];
  const count=(data?.count||0)+(ownMatches?1:0);
  return <div className="container section"><div className="directory-heading"><div><span className="eyebrow">BILIMNI YAQINLASHTIRAMIZ</span><h1>Keyingi mentoringiz shu yerda.</h1><p>O‘zingizga mos tajriba. Sizga qulay vaqt. 30 000–60 000 so‘m.</p></div><span className="directory-symbol">↗</span></div><form className="filter-bar" onSubmit={filter}><label className="search-field"><Search size={19}/><Input aria-label="Ism yoki sarlavha orqali qidirish" placeholder="Ism yoki yo‘nalish bo‘yicha qidirish" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Fan" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">Barcha fanlar</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><Input aria-label="Eng yuqori narx" type="number" min="30000" max="60000" step="1" placeholder="Maks. 60 000 so‘m" value={price} onChange={e=>setPrice(e.target.value)}/><Button><SlidersHorizontal size={16}/>Qidirish</Button></form><div className="results-bar"><span className="muted small">{loading?'Qidirilmoqda…':`${count} ta e’lon${showOwn&&!own?.is_public?' · sizning shaxsiy e’loningiz bilan':''}`}</span>{query&&<Button variant="ghost" size="sm" onClick={reset}>Filtrlarni tozalash</Button>}</div>{error&&<Notice kind="error">{error} <button onClick={load}>Qayta urinish</button></Notice>}{loading?<div className="mentor-grid">{[1,2,3].map(n=><div className="card skeleton" key={n}/>)}</div>:(rows.length||showOwn)?<div className="mentor-grid">{showOwn&&own&&<MentorCard mentor={own} own={own}/ >}{rows.map(m=><MentorCard key={m.id} mentor={m}/>)}</div>:!error&&<Empty title="Mos mentor topilmadi"><p>Filtrlarni o‘zgartiring yoki keyinroq qayting.</p><Button variant="outline" onClick={reset}>Filtrlarni tozalash</Button></Empty>}{data&&data.count>9&&<div className="pagination"><Button variant="outline" disabled={!data.previous||loading} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={16}/>Oldingi</Button><span>{page} / {Math.ceil(data.count/9)}</span><Button variant="outline" disabled={!data.next||loading} onClick={()=>setPage(p=>p+1)}>Keyingi<ArrowRight size={16}/></Button></div>}</div>;
}
