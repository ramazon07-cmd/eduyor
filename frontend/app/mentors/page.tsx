'use client';
import {useI18n} from '@/components/i18n';
import {useEffect,useState,useCallback,useRef} from 'react';
import {Search,SlidersHorizontal,ArrowLeft,ArrowRight,Globe} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {api} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice,Empty} from '@/components/common';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';

type Filters={search:string;subject:string;language:string};
const defaults:Filters={search:'',subject:'',language:''};
const languageNames:Record<string,string>={uz:'O‘zbekcha',en:'Inglizcha',ru:'Ruscha'};
const languagePatterns:Record<string,RegExp>={uz:/(^|[^a-zа-я])(o[‘’ʻʼ'`]?zbek(cha)?|uzbek|uz)([^a-zа-я]|$)/i,en:/(^|[^a-zа-я])(english|ingliz(cha)?|en)([^a-zа-я]|$)/i,ru:/(^|[^a-zа-я])(rus(cha)?|russian|русский|ru)([^a-zа-я]|$)/i};
function readFilters(params:URLSearchParams):Filters{return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,params.get(key)||value])) as Filters;}
function encodeFilters(filters:Filters,page=1){const params=new URLSearchParams();Object.entries(filters).forEach(([key,value])=>{if(value&&value!==defaults[key as keyof Filters])params.set(key,value);});if(page>1)params.set('page',String(page));return params.toString();}

export default function Directory(){
  const {t:translate}=useI18n();
  const {user,loading:authLoading,refresh}=useAuth();
  const requestId=useRef(0);
  const [data,setData]=useState<Page<Mentor>|null>(null);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [subjectError,setSubjectError]=useState('');
  const [draft,setDraft]=useState<Filters>(defaults);
  const [query,setQuery]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [validation,setValidation]=useState('');
  const params=new URLSearchParams(query||'');
  const applied=readFilters(params);
  const page=Math.max(1,Number(params.get('page'))||1);

  useEffect(()=>{if(user?.id)void refresh();},[user?.id,refresh]);
  const loadSubjects=useCallback(()=>{setSubjectError('');api<Subject[]>('subjects/').then(setSubjects).catch(()=>setSubjectError('Yo‘nalishlarni yuklab bo‘lmadi.'));},[]);
  useEffect(()=>{
    function restore(){const params=new URLSearchParams(window.location.search);setDraft(readFilters(params));setQuery(encodeFilters(readFilters(params),Math.max(1,Number(params.get('page'))||1)));setValidation('');}
    restore();loadSubjects();window.addEventListener('popstate',restore);
    return()=>window.removeEventListener('popstate',restore);
  },[loadSubjects]);
  const load=useCallback(async()=>{
    if(query===null||authLoading)return;
    const request=++requestId.current;setLoading(true);setError('');
    try{const result=await api<Page<Mentor>>(`mentors/?${query}&exclude_self=1`);if(request===requestId.current)setData(result);}
    catch(e){if(request===requestId.current){setError((e as Error).message);setData(null);}}
    finally{if(request===requestId.current)setLoading(false);}
  },[query,authLoading,user?.id]);
  useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
  function apply(filters:Filters,nextPage=1){
    setValidation('');setDraft(filters);
    const next=encodeFilters(filters,nextPage);window.history.pushState(null,'',`${window.location.pathname}${next?'?'+next:''}`);setQuery(next);
  }
  function reset(){apply({...defaults});}
  function update(key:keyof Filters,value:string){setDraft(f=>({...f,[key]:value}));setValidation('');}
  const own=user?.mentor_listing;
  const term=applied.search.toLowerCase().trim();
  const ownMatches=!!own&&(!term||[own.full_name,own.headline,...own.subjects.map(s=>s.name)].join(' ').toLowerCase().includes(term))&&(!applied.subject||own.subjects.some(s=>String(s.id)===applied.subject))&&(!applied.language||!!languagePatterns[applied.language]?.test(own.teaching_languages));
  const showOwn=ownMatches&&page===1;
  const rows=data?.results.filter(m=>!showOwn||m.id!==own?.id)||[];
  const count=(data?.count||0)+(ownMatches?1:0);
  const hasFilters=Object.values(applied).some(Boolean);

  return <div className="container section">
    <div className="directory-heading"><div><span className="eyebrow">{translate("O‘ZINGIZGA MOSINI TOPING")}</span><h1>{translate("Bir maqsad. Mos mentor.")}</h1><p>{translate("Yo‘nalish va ta’lim tili bo‘yicha tanlang.")}</p></div><span className="directory-symbol" aria-hidden="true">↗</span></div>
    <form className="directory-filters card" onSubmit={e=>{e.preventDefault();apply(draft);}}>
      <div className="directory-search-row"><label className="search-field"><Search size={20}/><Input aria-label={translate("Mentor qidirish")} placeholder={translate("Ism, yo‘nalish yoki sarlavha bo‘yicha qidirish")} maxLength={160} value={draft.search} onChange={e=>update('search',e.target.value)}/></label><Button><SlidersHorizontal size={17}/>{translate("Mentorlarni topish")}</Button></div>
      <div className="filter-fields">
        <label><span>{translate("Yo‘nalish")}</span><select aria-label={translate("Yo‘nalish")} value={draft.subject} onChange={e=>apply({...draft,subject:e.target.value})}><option value="">{translate("Barcha yo‘nalishlar")}</option>{subjects.map(s=><option key={s.id} value={s.id}>{translate(s.name)}</option>)}</select></label>
        <label><span><Globe size={14}/>{translate("Ta’lim tili")}</span><select aria-label={translate("Ta’lim tili")} value={draft.language} onChange={e=>apply({...draft,language:e.target.value})}><option value="">{translate("Barcha tillar")}</option>{Object.entries(languageNames).map(([id,name])=><option key={id} value={id}>{translate(name)}</option>)}</select></label>
      </div>
    </form>
    {subjectError&&<Notice kind="error">{translate(subjectError)}<button onClick={loadSubjects}>{translate("Qayta urinish")}</button></Notice>}
    {validation&&<Notice kind="error">{translate(validation)}</Notice>}
    <div className="directory-results-bar"><span className="muted small" role="status">{translate(loading?'Mentorlar qidirilmoqda…':error?'Natijalarni yuklab bo‘lmadi':`${count} ta e’lon${showOwn&&!own?.is_public?' · shaxsiy e’loningiz bilan':''}`)}</span>{hasFilters&&<button type="button" className="text-link" onClick={reset}>{translate("Filtrlarni tozalash")}</button>}</div>
    {error&&<Notice kind="error">{translate(error)}<button onClick={load}>{translate("Qayta urinish")}</button></Notice>}
    {loading?<div className="mentor-grid" aria-busy="true">{[1,2,3].map(n=><div className="card skeleton" key={n} aria-label={translate("Mentor yuklanmoqda")}/>)}</div>:!error&&(rows.length||showOwn)?<div className="mentor-grid">{showOwn&&own&&<MentorCard mentor={own} own={own}/ >}{rows.map(m=><MentorCard key={m.id} mentor={m}/>)}</div>:!error&&<Empty title={translate("Mos mentor topilmadi")}><p>{translate("Yo‘nalish yoki ta’lim tilini o‘zgartirib ko‘ring.")}</p></Empty>}
    {data&&data.count>9&&!error&&<div className="pagination"><Button variant="outline" disabled={!data.previous||loading} onClick={()=>apply(applied,page-1)}><ArrowLeft size={16}/>{translate("Oldingi")}</Button><span>{page} / {Math.ceil(data.count/9)}</span><Button variant="outline" disabled={!data.next||loading} onClick={()=>apply(applied,page+1)}>{translate("Keyingi")}<ArrowRight size={16}/></Button></div>}
  </div>;
}
